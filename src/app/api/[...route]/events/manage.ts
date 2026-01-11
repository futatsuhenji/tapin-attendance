import { Hono } from 'hono';

import invitation from './manage/invitation';
import members from './manage/members';
import administrators from './manage/administrators';
import { prisma } from '@/lib/prisma';

import { AttendanceType } from '@/generated/prisma/enums';

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
                    id: true,
                    groupId: true,
                    name: true,
                    description: true,
                    place: true,
                    mapUrl: true,
                    startsAt: true,
                    endsAt: true,
                    registrationEndsAt: true,
                    eventMail: { select: { updatedAt: true } },
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
                        orderBy: { updatedAt: 'desc' },
                    },
                },
            });

            if (!event || event.groupId !== groupId) {
                return c.json({ message: 'Event not found' }, 404);
            }

            const counts: Record<'total' | 'presence' | 'partial' | 'absence' | 'unanswered', number> = {
                total: event.attendances.length,
                presence: 0,
                partial: 0,
                absence: 0,
                unanswered: 0,
            };

            const attendees = event.attendances.map((attendance) => {
                const status = attendanceOrUnanswered(attendance.attendance);
                if (status === AttendanceType.PRESENCE) counts.presence += 1;
                if (status === AttendanceType.PRESENCE_PARTIALLY) counts.partial += 1;
                if (status === AttendanceType.ABSENCE) counts.absence += 1;
                if (status === AttendanceType.UNANSWERED) counts.unanswered += 1;

                return {
                    id: attendance.user.id,
                    name: attendance.user.name,
                    email: attendance.user.email,
                    status,
                    comment: attendance.comment,
                    updatedAt: attendance.updatedAt,
                };
            });

            return c.json({
                event: {
                    name: event.name,
                    description: event.description,
                    place: event.place,
                    mapUrl: event.mapUrl,
                    startsAt: event.startsAt,
                    endsAt: event.endsAt,
                    registrationEndsAt: event.registrationEndsAt,
                },
                invitation: {
                    hasMail: Boolean(event.eventMail),
                    sentAt: event.eventMail?.updatedAt ?? null,
                },
                attendance: counts,
                attendees,
            });
        } catch (e) {
            if (e instanceof Response) return e;
            console.error('Failed to load event manage data', e);
            return c.json({ message: 'Unknown error' }, 500);
        }
    })
    .route('/invitation', invitation)
    .route('/members', members)
    .route('/administrators', administrators);

export default app;
