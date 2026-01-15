// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-FileCopyrightText: 2026 Yu Yokoyama <25w6105e@shinshu-u.ac.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import administrators from './administrators';
import { getPrismaClient } from '@/lib/prisma';

const app = new Hono()
    .get('/', async (c) => {
        const prisma = await getPrismaClient();
        const groupId = c.req.param('groupId');

        if (!groupId) return c.json({ message: 'Group ID is missing' }, 400);

        try {
            const group = await prisma.eventGroup.findUnique({
                where: { id: groupId },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    ownerId: true,
                    owner: { select: { name: true, email: true } },
                    createdAt: true,
                },
            });

            if (!group) return c.json({ message: 'Event group not found' }, 404);

            return c.json({
                ...group,
                ownerName: group.owner.name,
                ownerEmail: group.owner.email,
            }, 200);
        } catch (e) {
            if (e instanceof Response) return e;
            return c.json({ message: 'Unknown error' }, 500);
        }
    })
    .route('/administrators', administrators)
    .patch(
        '/',
        zValidator(
            'json',
            z.object({
                name: z.string().min(1).optional(),
                description: z.string().optional(),
            }),
        ),
        async (c) => {
            const prisma = await getPrismaClient();
            const groupId = c.req.param('groupId');
            const { name, description } = c.req.valid('json');

            if (!groupId) return c.json({ message: 'Group ID is missing' }, 400);

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
        '/',
        async (c) => {
            const prisma = await getPrismaClient();
            const groupId = c.req.param('groupId');

            if (!groupId) return c.json({ message: 'Group ID is missing' }, 400);

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
