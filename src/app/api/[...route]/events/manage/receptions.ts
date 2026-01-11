import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { AttendanceType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';

const attendanceOrUnanswered = (value: AttendanceType | null) => value ?? AttendanceType.UNANSWERED;

const app = new Hono()
    .get('/', async (c) => {
        const groupId = c.req.param('groupId');
        const eventId = c.req.param('eventId');

        if (!groupId || !eventId) return c.json({ message: 'Invalid parameters' }, 400);

        try {
            const event = await prisma.event.findUnique({
                where: { id: eventId },
                select: {
                    groupId: true,
                    name: true,
                    place: true,
                    startsAt: true,
                    endsAt: true,
                    attendances: {
                        select: {
                            attendance: true,
                            comment: true,
                            updatedAt: true,
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                },
                            },
                        },
                        orderBy: { createdAt: 'asc' },
                    },
                    receptions: {
                        select: {
                            visitorId: true,
                            isRecepted: true,
                            updatedAt: true,
                        },
                    },
                    feeReceipts: {
                        select: {
                            visitorId: true,
                            amount: true,
                            receipted: true,
                            updatedAt: true,
                        },
                    },
                },
            });

            if (!event || event.groupId !== groupId) {
                return c.json({ message: 'Event not found' }, 404);
            }

            const receptionMap = new Map(event.receptions.map((reception) => [reception.visitorId, reception] as const));
            const feeMap = new Map(event.feeReceipts.map((fee) => [fee.visitorId, fee] as const));

            const attendees = event.attendances
                .map((attendance) => {
                    const reception = receptionMap.get(attendance.user.id);
                    const fee = feeMap.get(attendance.user.id);
                    return {
                        id: attendance.user.id,
                        name: attendance.user.name,
                        email: attendance.user.email,
                        response: attendanceOrUnanswered(attendance.attendance),
                        comment: attendance.comment,
                        updatedAt: attendance.updatedAt,
                        isRecepted: reception?.isRecepted ?? false,
                        receptionUpdatedAt: reception?.updatedAt ?? null,
                        feeAmount: fee?.amount ?? null,
                        feePaid: fee?.receipted ?? 0,
                    };
                })
                // eslint-disable-next-line unicorn/no-array-sort
                .sort((a, b) => a.name.localeCompare(b.name, 'ja') || a.email.localeCompare(b.email, 'ja'));

            const checkedIn = attendees.filter((attendee) => attendee.isRecepted).length;
            const feeTotal = attendees.reduce((sum, attendee) => sum + (attendee.feeAmount ?? 0), 0);
            const feePaid = attendees.reduce((sum, attendee) => sum + (attendee.feePaid ?? 0), 0);
            const feeRemaining = Math.max(feeTotal - feePaid, 0);

            return c.json({
                event: {
                    name: event.name,
                    place: event.place,
                    startsAt: event.startsAt,
                    endsAt: event.endsAt,
                },
                reception: {
                    total: attendees.length,
                    checkedIn,
                    pending: attendees.length - checkedIn,
                },
                fee: {
                    totalDue: feeTotal,
                    totalPaid: feePaid,
                    remaining: feeRemaining,
                },
                attendees,
            }, 200);
        } catch (e) {
            if (e instanceof Response) return e;
            console.error('Failed to load reception status', e);
            return c.json({ message: 'Unknown error' }, 500);
        }
    })
    .post(
        '/',
        zValidator(
            'json',
            z.object({
                userId: z.string().cuid(),
                isRecepted: z.boolean().optional(),
                receipted: z.number().int().nonnegative().optional(),
                amount: z.number().int().nonnegative().optional(),
            }).refine((value) => value.isRecepted !== undefined || value.receipted !== undefined || value.amount !== undefined, {
                message: 'No update specified',
            }),
        ),
        async (c) => {
            const groupId = c.req.param('groupId');
            const eventId = c.req.param('eventId');
            const { userId, isRecepted, receipted, amount } = c.req.valid('json');

            if (!groupId || !eventId) return c.json({ message: 'Invalid parameters' }, 400);

            try {
                return await prisma.$transaction(async (tx) => {
                    const event = await tx.event.findUnique({
                        where: { id: eventId },
                        select: { groupId: true },
                    });

                    if (!event || event.groupId !== groupId) {
                        return c.json({ message: 'Event not found' }, 404);
                    }

                    const attendance = await tx.attendance.findUnique({
                        where: { eventId_userId: { eventId, userId } },
                        select: {
                            attendance: true,
                            comment: true,
                            updatedAt: true,
                            user: {
                                select: { id: true, name: true, email: true },
                            },
                        },
                    });

                    if (!attendance) {
                        return c.json({ message: '参加者が見つかりません' }, 404);
                    }

                    const reception = isRecepted === undefined
                        ? await tx.reception.findUnique({
                            where: { eventId_visitorId: { eventId, visitorId: userId } },
                            select: { isRecepted: true, updatedAt: true },
                        })
                        : await tx.reception.upsert({
                            where: { eventId_visitorId: { eventId, visitorId: userId } },
                            create: { eventId, visitorId: userId, isRecepted },
                            update: { isRecepted },
                            select: { isRecepted: true, updatedAt: true },
                        });

                    const fee = (receipted !== undefined || amount !== undefined)
                        ? await tx.eventFee.upsert({
                            where: { eventId_visitorId: { eventId, visitorId: userId } },
                            create: {
                                eventId,
                                visitorId: userId,
                                amount: amount ?? 0,
                                receipted: receipted ?? 0,
                            },
                            update: {
                                amount: amount ?? undefined,
                                receipted: receipted ?? undefined,
                            },
                            select: { amount: true, receipted: true, updatedAt: true },
                        })
                        : await tx.eventFee.findUnique({
                            where: { eventId_visitorId: { eventId, visitorId: userId } },
                            select: { amount: true, receipted: true, updatedAt: true },
                        });

                    return c.json({
                        attendee: {
                            id: attendance.user.id,
                            name: attendance.user.name,
                            email: attendance.user.email,
                            response: attendanceOrUnanswered(attendance.attendance),
                            comment: attendance.comment,
                            updatedAt: attendance.updatedAt,
                            isRecepted: reception?.isRecepted ?? false,
                            receptionUpdatedAt: reception?.updatedAt ?? null,
                            feeAmount: fee?.amount ?? null,
                            feePaid: fee?.receipted ?? 0,
                        },
                    }, 200);
                });
            } catch (e) {
                if (e instanceof Response) return e;
                console.error('Failed to update reception status', e);
                return c.json({ message: 'Unknown error' }, 500);
            }
        },
    );

export default app;
