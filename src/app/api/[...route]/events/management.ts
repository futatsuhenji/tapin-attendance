import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';

import { prisma } from '@/lib/prisma';
import { getJwtFromContext } from '@/utils/auth';

const app = new Hono()
    // -------------------------------------------------------
    // 1. イベント一覧取得
    // パス: GET /api/events/:groupId
    // -------------------------------------------------------
    .get('/', async (c) => {
        const groupId = c.req.param('groupId');
        const jwt = await getJwtFromContext(c);

        if (!groupId) return c.json({ message: 'Group ID is required' }, 400);
        if (!jwt) return c.json({ events: [] }, 200);

        const userId = jwt.user.id;

        try {
            // グループオーナー / 管理者確認
            const group = await prisma.eventGroup.findUnique({
                where: { id: groupId },
                select: { ownerId: true },
            });

            if (!group) return c.json({ message: 'Group not found' }, 404);

            const isGroupOwner = group.ownerId === userId;
            const isGroupAdmin = await prisma.eventGroupAdministrator.findUnique({
                where: { groupId_userId: { groupId, userId } },
                select: { userId: true },
            });

            const whereCondition: Prisma.EventWhereInput = { groupId };

            // グループオーナー or グループ管理者は全件
            if (!isGroupOwner && !isGroupAdmin) {
                whereCondition.OR = [
                    { ownerId: userId },
                    { administrators: { some: { userId } } },
                    { attendances: { some: { userId } } },
                ];
            }

            const events = await prisma.event.findMany({
                where: whereCondition,
                orderBy: { startsAt: 'asc' },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    place: true,
                    startsAt: true,
                    endsAt: true,
                    registrationEndsAt: true,
                    ownerId: true,
                    administrators: { select: { userId: true } },
                },
            });

            const enriched = events.map((event) => {
                const canManage =
                    event.ownerId === userId || event.administrators.some((admin) => admin.userId === userId) || !!isGroupAdmin;
                return {
                    ...event,
                    canManage,
                    administrators: undefined,
                } as unknown as { id: string; name: string; description: string | null; place: string | null; startsAt: Date | null; endsAt: Date | null; registrationEndsAt: Date | null; ownerId: string; canManage: boolean };
            });

            return c.json({ events: enriched }, 200);
        } catch (e) {
            if (e instanceof Response) return e;
            console.error('Failed to fetch events:', e);
            return c.json({ message: 'Internal Server Error' }, 500);
        }
    })
    .post(
        '/',
        zValidator(
            'json',
            z.object({
                name: z.string().min(1, { message: 'Name is required' }),
                ownerId: z.string().cuid({ message: 'Invalid owner ID' }),
                description: z.string().optional(),
                place: z.string().optional(),
                mapUrl: z.string().url().optional().or(z.literal('')),
                startsAt: z.string().datetime().optional(),
                endsAt: z.string().datetime().optional(),
                publishedAt: z.string().datetime().optional(),
                registrationEndsAt: z.string().datetime().optional(),
                allowVisitorListSharing: z.boolean().optional(),
            }),
        ),
        async (c) => {
            const groupId = c.req.param('groupId');
            const {
                name,
                ownerId,
                description,
                place,
                mapUrl,
                startsAt,
                endsAt,
                publishedAt,
                registrationEndsAt,
                allowVisitorListSharing,
            } = c.req.valid('json');

            if (!groupId) return c.json({ message: 'Group ID is missing' }, 400);

            try {
                return await prisma.$transaction(async (tx) => {
                    const group = await tx.eventGroup.findUnique({ where: { id: groupId } });
                    if (!group) return c.json({ message: 'Event group not found' }, 404);

                    const user = await tx.user.findUnique({ where: { id: ownerId } });
                    if (!user) return c.json({ message: 'Owner user not found', userId: ownerId }, 404);

                    // イベント作成
                    const event = await tx.event.create({
                        data: {
                            groupId,
                            ownerId,
                            name,
                            description,
                            place,
                            mapUrl,
                            startsAt: startsAt ? new Date(startsAt) : null,
                            endsAt: endsAt ? new Date(endsAt) : null,
                            publishedAt: publishedAt ? new Date(publishedAt) : null,
                            registrationEndsAt: registrationEndsAt ? new Date(registrationEndsAt) : null,
                            allowVisitorListSharing: allowVisitorListSharing ?? false,
                        },
                    });

                    // 管理者に追加
                    await tx.eventAdministrator.create({
                        data: {
                            eventId: event.id,
                            userId: ownerId,
                        },
                    });

                    // オーナーを attendance に登録
                    await tx.attendance.upsert({
                        where: { eventId_userId: { eventId: event.id, userId: ownerId } },
                        create: { eventId: event.id, userId: ownerId },
                        update: {},
                    });

                    // グループ管理者も attendance に登録
                    const groupAdmins = await tx.eventGroupAdministrator.findMany({
                        where: { groupId },
                        select: { userId: true },
                    });
                    for (const admin of groupAdmins) {
                        await tx.attendance.upsert({
                            where: { eventId_userId: { eventId: event.id, userId: admin.userId } },
                            create: { eventId: event.id, userId: admin.userId },
                            update: {},
                        });
                    }

                    return c.json(event, 201);
                });
            } catch (e) {
                if (e instanceof Response) return e;
                console.error('Failed to create event:', e);
                return c.json({ message: 'Unknown error' }, 500);
            }
        },
    );

export default app;
