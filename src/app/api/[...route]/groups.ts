import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

const app = new Hono()
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
    )
    .patch(
        '/:groupId',
        zValidator(
            'json',
            z.object({
                name: z.string().min(1).optional(),
                description: z.string().optional(),
            }),
        ),
        async (c) => {
            const groupId = c.req.param('groupId')!;
            const { name, description } = c.req.valid('json');

            try {
                return await prisma.$transaction(async (tx) => {
                    // 更新対象のグループ存在確認
                    if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                        const updatedGroup = await tx.eventGroup.update({
                            where: { id: groupId },
                            data: {
                                name,
                                description,
                            },
                        });
                        return c.json(updatedGroup, 200);
                    } else {
                        return c.json({ message: 'Event group not found' }, 404);
                    }
                });
            } catch (e) {
                if (e instanceof Response) return e;
                return c.json({ message: 'Unknown error' }, 500);
            }
        },
    )
    .delete(
        '/:groupId',
        async (c) => {
            const groupId = c.req.param('groupId')!;

            try {
                return await prisma.$transaction(async (tx) => {
                    // 削除対象のグループ存在確認
                    if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                        await tx.eventGroup.delete({ where: { id: groupId } });
                        return c.json({ message: 'Event group deleted' }, 200);
                    } else {
                        return c.json({ message: 'Event group not found' }, 404);
                    }
                });
            } catch (e) {
                if (e instanceof Response) return e;
                return c.json({ message: 'Unknown error' }, 500);
            }
        },
    );

export default app;