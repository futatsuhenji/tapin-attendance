import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { AttendanceType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';

const attendanceOrUnanswered = (value: AttendanceType | null) => value ?? AttendanceType.UNANSWERED;

function deriveStandardAmount(amounts: Array<number | null | undefined>): number | null {
    const filtered = amounts.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (filtered.length === 0) return null;
    const counts = new Map<number, number>();
    for (const value of filtered) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    let standard: number | null = null;
    let max = 0;
    for (const [value, count] of counts.entries()) {
        if (count > max) {
            max = count;
            standard = value;
        }
    }
    return standard;
}

async function buildFeePayload(eventId: string, groupId: string) {
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
            groupId: true,
            attendances: {
                select: {
                    attendance: true,
                    comment: true,
                    updatedAt: true,
                    user: { select: { id: true, name: true, email: true } },
                },
            },
            feeReceipts: {
                select: { visitorId: true, amount: true, receipted: true },
            },
        },
    });

    if (!event || event.groupId !== groupId) return null;

    const feeMap = new Map(event.feeReceipts.map((fee) => [fee.visitorId, fee] as const));

    const attendees = event.attendances.map((attendance) => {
        const fee = feeMap.get(attendance.user.id);
        const amount = fee?.amount ?? null;
        const receipted = fee?.receipted ?? 0;
        return {
            id: attendance.user.id,
            name: attendance.user.name,
            email: attendance.user.email,
            response: attendanceOrUnanswered(attendance.attendance),
            comment: attendance.comment,
            updatedAt: attendance.updatedAt,
            feeAmount: amount,
            feePaid: receipted,
        };
    });

    const standardAmount = deriveStandardAmount(attendees.map((attendee) => attendee.feeAmount));
    const totalDue = attendees.reduce((sum, attendee) => sum + (attendee.feeAmount ?? 0), 0);
    const totalPaid = attendees.reduce((sum, attendee) => sum + (attendee.feePaid ?? 0), 0);

    return {
        standardAmount,
        summary: {
            totalDue,
            totalPaid,
            remaining: Math.max(totalDue - totalPaid, 0),
        },
        attendees,
    } as const;
}

const app = new Hono()
    .get('/', async (c) => {
        const groupId = c.req.param('groupId');
        const eventId = c.req.param('eventId');

        if (!groupId || !eventId) return c.json({ message: 'Invalid parameters' }, 400);

        try {
            const payload = await buildFeePayload(eventId, groupId);
            if (!payload) return c.json({ message: 'Event not found' }, 404);
            return c.json(payload, 200);
        } catch (e) {
            if (e instanceof Response) return e;
            console.error('Failed to load fee config', e);
            return c.json({ message: 'Unknown error' }, 500);
        }
    })
    .post(
        '/',
        zValidator('json', z.object({ amount: z.number().int().nonnegative() })),
        async (c) => {
            const groupId = c.req.param('groupId');
            const eventId = c.req.param('eventId');
            const { amount } = c.req.valid('json');

            if (!groupId || !eventId) return c.json({ message: 'Invalid parameters' }, 400);

            try {
                await prisma.$transaction(async (tx) => {
                    const event = await tx.event.findUnique({
                        where: { id: eventId },
                        select: { groupId: true },
                    });

                    if (!event || event.groupId !== groupId) {
                        throw new Response('Event not found', { status: 404 });
                    }

                    const attendees = await tx.attendance.findMany({
                        where: { eventId },
                        select: { userId: true },
                    });

                    for (const attendee of attendees) {
                        const existing = await tx.eventFee.findUnique({
                            where: { eventId_visitorId: { eventId, visitorId: attendee.userId } },
                            select: { receipted: true },
                        });

                        const clampedReceipted = existing ? Math.min(existing.receipted, amount) : 0;

                        await tx.eventFee.upsert({
                            where: { eventId_visitorId: { eventId, visitorId: attendee.userId } },
                            create: {
                                eventId,
                                visitorId: attendee.userId,
                                amount,
                                receipted: clampedReceipted,
                            },
                            update: {
                                amount,
                                receipted: clampedReceipted,
                            },
                        });
                    }
                });

                const payload = await buildFeePayload(eventId, groupId);
                if (!payload) return c.json({ message: 'Event not found' }, 404);
                return c.json(payload, 200);
            } catch (e) {
                if (e instanceof Response) return e;
                console.error('Failed to update fee config', e);
                return c.json({ message: 'Unknown error' }, 500);
            }
        },
    );

export default app;
