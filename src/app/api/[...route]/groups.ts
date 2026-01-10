import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { getJwtFromContext } from '@/utils/auth';

import handler from './groups/handler';

const app = new Hono()
    // -------------------------------------------------------
    // 1. 詳細操作へのルーティング
    // パス: /api/groups/:groupId/...
    // -------------------------------------------------------
    .route('/:groupId', handler)

    // -------------------------------------------------------
    // 2. グループ一覧取得
    // パス: GET /api/groups
    // 要件: 自分がオーナーのグループ OR 参加履歴のあるグループ
    // -------------------------------------------------------
    .get(
        '/',
        async (c) => {
            const jwt = await getJwtFromContext(c);

            if (!jwt) {
                return c.json([], 200);
            }

            const userId = jwt.user.id;

            try {
                const groups = await prisma.eventGroup.findMany({
                    where: {
                        OR: [
                            { ownerId: userId },
                            {
                                events: {
                                    some: {
                                        attendances: {
                                            some: { userId: userId },
                                        },
                                    },
                                },
                            },
                        ],
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                });

                return c.json(groups, 200);
            } catch (e) {
                if (e instanceof Response) return e;
                console.error('Failed to fetch groups:', e);
                return c.json({ message: 'Internal Server Error' }, 500);
            }
        },
    )

    // -------------------------------------------------------
    // 3. グループ新規作成
    // パス: POST /api/groups
    // -------------------------------------------------------
    .post(
        '/',
        zValidator(
            'json',
            z.object({
                name: z.string().min(1, { message: 'Name is required' }),
                ownerId: z.string().cuid({ message: 'Invalid owner ID' }),
                description: z.string().optional(),
            }),
        ),
        async (c) => {
            const { name, ownerId, description } = c.req.valid('json');

            try {
                return await prisma.$transaction(async (tx) => {
                    const owner = await tx.user.findUnique({
                        where: { id: ownerId },
                    });

                    if (!owner) {
                        return c.json({ message: 'Owner user not found', userId: ownerId }, 404);
                    }

                    const group = await tx.eventGroup.create({
                        data: {
                            name,
                            ownerId,
                            description,
                        },
                    });

                    return c.json(group, 201);
                });
            } catch (e) {
                if (e instanceof Response) return e;
                console.error('Failed to create group:', e);
                return c.json({ message: 'Internal Server Error' }, 500);
            }
        },
    );

export default app;
