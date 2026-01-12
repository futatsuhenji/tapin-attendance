// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { AttendanceType } from '@/generated/prisma/enums';
import { getJwtFromContext } from '@/utils/auth';

const app = new Hono()
    .get('/', async (c) => {
        const groupId = c.req.param('groupId');
        const eventId = c.req.param('eventId');

        if (!groupId || !eventId) return c.json({ message: 'Invalid parameters' }, 400);

        const jwt = await getJwtFromContext(c);
        const userId = jwt?.user.id ?? null;

        try {
            const event = await prisma.event.findUnique({
                where: { id: eventId },
                select: {
                    id: true,
                    groupId: true,
                    group: { select: { name: true } },
                    ownerId: true,
                    name: true,
                    description: true,
                    place: true,
                    mapUrl: true,
                    allowVisitorListSharing: true,
                    registrationEndsAt: true,
                    startsAt: true,
                    endsAt: true,
                },
            });

            if (!event || event.groupId !== groupId) {
                return c.json({ message: 'Event not found' }, 404);
            }

            let attendance: { status: AttendanceType; comment: string | null; updatedAt: Date } | null = null;
            let isManager = false;

            if (userId) {
                const attendanceRecord = await prisma.attendance.findUnique({
                    where: { eventId_userId: { eventId, userId } },
                    select: { attendance: true, comment: true, updatedAt: true },
                });

                if (attendanceRecord) {
                    attendance = {
                        status: attendanceRecord.attendance ?? AttendanceType.UNANSWERED,
                        comment: attendanceRecord.comment ?? null,
                        updatedAt: attendanceRecord.updatedAt,
                    };
                }

                if (event.ownerId === userId) {
                    isManager = true;
                } else {
                    const admin = await prisma.eventAdministrator.findUnique({
                        where: { eventId_userId: { eventId, userId } },
                    });
                    isManager = Boolean(admin);
                }
            }

            return c.json({
                event: {
                    id: event.id,
                    name: event.name,
                    groupName: event.group.name,
                    description: event.description,
                    place: event.place,
                    mapUrl: event.mapUrl,
                    allowVisitorListSharing: event.allowVisitorListSharing,
                    registrationEndsAt: event.registrationEndsAt,
                    startsAt: event.startsAt,
                    endsAt: event.endsAt,
                },
                attendance,
                manage: { isManager },
            }, 200);
        } catch (e) {
            if (e instanceof Response) return e;
            return c.json({ message: 'Unknown error' }, 500);
        }
    })
    .post(
        '/attendance',
        zValidator('json', z.object({
            status: z.nativeEnum(AttendanceType),
            comment: z.string().max(1000).optional().nullable(),
        })),
        async (c) => {
            const groupId = c.req.param('groupId');
            const eventId = c.req.param('eventId');
            const { status, comment } = c.req.valid('json');

            if (!groupId || !eventId) return c.json({ message: 'Invalid parameters' }, 400);

            const jwt = await getJwtFromContext(c);
            if (!jwt) return c.json({ message: 'Unauthorized' }, 401);

            const userId = jwt.user.id;

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
                    });

                    if (!attendance) {
                        return c.json({ message: 'Attendance not found' }, 404);
                    }

                    const updated = await tx.attendance.update({
                        where: { eventId_userId: { eventId, userId } },
                        data: {
                            attendance: status,
                            comment: comment ?? null,
                        },
                        select: {
                            attendance: true,
                            comment: true,
                            updatedAt: true,
                        },
                    });

                    return c.json({
                        attendance: {
                            status: updated.attendance ?? AttendanceType.UNANSWERED,
                            comment: updated.comment ?? null,
                            updatedAt: updated.updatedAt,
                        },
                    }, 200);
                });
            } catch (e) {
                if (e instanceof Response) return e;
                return c.json({ message: 'Unknown error' }, 500);
            }
        },
    )
    .patch(
        '/',
        zValidator('json', z.object({
            name: z.string().min(1).optional(),
            description: z.string().optional(),
            place: z.string().optional(),
            mapUrl: z.string().url().optional().or(z.literal('')),
            startsAt: z.string().datetime().optional(),
            endsAt: z.string().datetime().optional(),
            publishedAt: z.string().datetime().optional(),
            registrationEndsAt: z.string().datetime().optional(),
            allowVisitorListSharing: z.boolean().optional(),
        })),
        async (c) => {
            const groupId = c.req.param('groupId');
            const eventId = c.req.param('eventId');
            const data = c.req.valid('json');

            if (!groupId || !eventId) return c.json({ message: 'Invalid parameters' }, 400);

            try {
                return await prisma.$transaction(async (tx) => {
                    const event = await tx.event.findUnique({ where: { id: eventId } });
                    if (!event || event.groupId !== groupId) {
                        return c.json({ message: 'Event not found' }, 404);
                    }
                    const updatedEvent = await tx.event.update({
                        where: { id: eventId },
                        data: {
                            ...data,
                            startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
                            endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
                            publishedAt: data.publishedAt ? new Date(data.publishedAt) : undefined,
                            registrationEndsAt: data.registrationEndsAt ? new Date(data.registrationEndsAt) : undefined,
                        },
                    });
                    return c.json(updatedEvent, 200);
                });
            } catch (e) {
                if (e instanceof Response) return e;
                return c.json({ message: 'Unknown error' }, 500);
            }
        },
    )
    .delete('/', async (c) => {
        const groupId = c.req.param('groupId');
        const eventId = c.req.param('eventId');

        if (!groupId || !eventId) return c.json({ message: 'Invalid parameters' }, 400);

        try {
            return await prisma.$transaction(async (tx) => {
                const event = await tx.event.findUnique({ where: { id: eventId } });
                if (!event || event.groupId !== groupId) {
                    return c.json({ message: 'Event not found' }, 404);
                }
                await tx.event.delete({ where: { id: eventId } });
                return c.json({ message: 'Event deleted' }, 200);
            });
        } catch (e) {
            if (e instanceof Response) return e;
            return c.json({ message: 'Unknown error' }, 500);
        }
    });

export default app;
