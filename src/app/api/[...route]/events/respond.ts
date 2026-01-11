import { Hono } from 'hono';

import { AttendanceType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import cuid from 'cuid';

type Decision = 'attend' | 'absence';

const decisionToAttendance = (decision: Decision) =>
    decision === 'attend' ? AttendanceType.PRESENCE : AttendanceType.ABSENCE;

const app = new Hono()
    .get('/', async (c) => {
        const groupId = c.req.param('groupId');
        const eventId = c.req.param('eventId');

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { name: true, group: { select: { name: true, id: true } } },
        });

        if (!event || event.group.id !== groupId) {
            return c.json({ message: 'Event not found' }, 404);
        }

        return c.json({ eventName: event.name, groupName: event.group.name });
    })
    // 出欠状況を取得するAPI
    .get('/status/:token', async (c) => {
        const token = c.req.param('token');

        // secret(token) をキーに、回答データとイベント情報を取得
        const attendance = await prisma.attendance.findFirst({
            where: { secret: token },
            select: {
                attendance: true,
                comment: true,
                event: {
                    select: {
                        name: true,
                        registrationEndsAt: true,
                        group: { select: { name: true } },
                    },
                },
            },
        });

        if (!attendance) {
            return c.json({ message: 'Invalid token' }, 404);
        }

        return c.json({
            status: attendance.attendance,
            comment: attendance.comment ?? '',
            eventName: attendance.event.name,
            groupName: attendance.event.group.name,
            registrationEndsAt: attendance.event.registrationEndsAt,
        });
    })
    .get('/:decision', async (c) => {
        const decision = c.req.param('decision') as Decision;
        const token = c.req.query('token');

        if (!token) {
            return c.json({ message: 'token is required' }, 400);
        }
        if (decision !== 'attend' && decision !== 'absence') {
            return c.json({ message: 'invalid decision' }, 400);
        }

        const attendance = await prisma.attendance.findFirst({
            where: { secret: token },
            select: { eventId: true, userId: true, event: { select: { groupId: true } } },
        });

        if (!attendance) {
            return c.json({ message: 'Token not found' }, 404);
        }

        await prisma.attendance.update({
            where: { eventId_userId: { eventId: attendance.eventId, userId: attendance.userId } },
            data: {
                attendance: decisionToAttendance(decision),

                isMailOpened: true,
                secret: cuid(),
            },
        });

        const origin = new URL(c.req.url).origin;
        const redirectUrl = `${origin}/event/${attendance.event.groupId}/${attendance.eventId}/response?decision=${decision}`;
        return c.redirect(redirectUrl, 302);
    });

export default app;
