import { Hono } from 'hono';
import { AttendanceType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import cuid from 'cuid';
import { sendAttendanceConfirmationMail } from '@/utils/mail';

type Decision = 'attend' | 'absence';

const decisionToAttendance = (decision: Decision) =>
    decision === 'attend' ? AttendanceType.PRESENCE : AttendanceType.ABSENCE;

const app = new Hono()
    // イベント・グループ名の基本情報取得
    .get('/', async (c) => {
        const groupId = c.req.param('groupId');
        const eventId = c.req.param('eventId');

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: {
                name: true,
                startsAt: true,
                endsAt: true,
                place: true,
                description: true,
                group: { select: { name: true, id: true } },
            },
        });

        if (!event || event.group.id !== groupId) {
            return c.json({ message: 'Event not found' }, 404);
        }

        return c.json({
            eventName: event.name,
            groupName: event.group.name,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            place: event.place,
            description: event.description,
        });
    })

    // 1. 出欠状況を取得するAPI (Web表示用)
    .get('/status/:token', async (c) => {
        const token = c.req.param('token');

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

    // 2. Webからの回答上書き保存API
    .patch('/status/:token', async (c) => {
        const token = c.req.param('token');
        const body = await c.req.json<{ status: AttendanceType; comment: string }>();

        const attendance = await prisma.attendance.findFirst({
            where: { secret: token },
            include: {
                event: true,
                user: { select: { email: true, name: true } },
            },
        });

        if (!attendance) {
            return c.json({ message: 'Token not found' }, 404);
        }

        // 期限チェック
        if (attendance.event.registrationEndsAt && new Date() > new Date(attendance.event.registrationEndsAt)) {
            return c.json({ message: 'Registration period has ended' }, 400);
        }

        // DB更新（Web編集なのでsecretは維持する）
        await prisma.attendance.update({
            where: { eventId_userId: { eventId: attendance.eventId, userId: attendance.userId } },
            data: {
                attendance: body.status,
                comment: body.comment,
            },
        });

        // 完了メール送信 (mail.ts の新しい引数に合わせて修正)
        await sendAttendanceConfirmationMail({
            to: attendance.user.email,
            userName: attendance.user.name,
            eventName: attendance.event.name,
            attendance: body.status,
            groupId: attendance.event.groupId,
            eventId: attendance.eventId,
            token: token, // 既存のトークンを使用
        });

        return c.json({ message: 'Updated successfully' });
    })

    // 3. メール内の「出席/欠席」ボタンからの1クリック回答API
    .get('/:decision', async (c) => {
        const decision = c.req.param('decision') as Decision;
        const token = c.req.query('token');

        if (!token) return c.json({ message: 'token is required' }, 400);
        if (decision !== 'attend' && decision !== 'absence') {
            return c.json({ message: 'invalid decision' }, 400);
        }

        const attendance = await prisma.attendance.findFirst({
            where: { secret: token },
            include: {
                event: true,
                user: { select: { email: true, name: true } },
            },
        });

        if (!attendance) return c.json({ message: 'Token not found' }, 404);

        // トークンの再生成
        const newSecret = cuid();
        const newAttendance = decisionToAttendance(decision);

        await prisma.attendance.update({
            where: { eventId_userId: { eventId: attendance.eventId, userId: attendance.userId } },
            data: {
                attendance: newAttendance,
                isMailOpened: true,
                secret: newSecret,
            },
        });

        // 新しいトークンで完了メールを送信 (mail.ts の新しい引数に合わせて修正)
        await sendAttendanceConfirmationMail({
            to: attendance.user.email,
            userName: attendance.user.name,
            eventName: attendance.event.name,
            attendance: newAttendance,
            groupId: attendance.event.groupId,
            eventId: attendance.eventId,
            token: newSecret,
        });

        const origin = new URL(c.req.url).origin;
        const redirectUrl = `${origin}/event/${attendance.event.groupId}/${attendance.eventId}/response?decision=${decision}`;
        return c.redirect(redirectUrl, 302);
    });

export default app;
