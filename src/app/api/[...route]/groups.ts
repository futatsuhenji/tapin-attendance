import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import handler from './groups/handler'; // 子ファイルをインポート

const app = new Hono()
    .route('/:groupId', handler)

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
                    // オーナーとなるユーザーの存在確認
                    if (await tx.user.findUnique({ where: { id: ownerId } })) {
                        const group = await tx.eventGroup.create({
                            data: {
                                name,
                                ownerId,
                                description,
                            },
                        });
                        return c.json(group, 201);
                    } else {
                        return c.json({ message: 'Owner user not found', userId: ownerId }, 404);
                    }
                });
            } catch (e) {
                if (e instanceof Response) return e;
                return c.json({ message: 'Unknown error' }, 500);
            }
        },
    );

export default app;
