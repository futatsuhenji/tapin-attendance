// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

const app = new Hono()
    .get('/', async (c) => {
        const groupId = c.req.param('groupId');

        if (!groupId) return c.json({ message: 'Group ID is missing' }, 400);

        try {
            return await prisma.$transaction(async (tx) => {
                const group = await tx.eventGroup.findUnique({
                    where: { id: groupId },
                    select: {
                        ownerId: true,
                        owner: { select: { id: true, name: true, email: true } },
                    },
                });

                if (!group) return c.json({ message: 'Event group not found' }, 404);

                const admins = await tx.eventGroupAdministrator.findMany({
                    where: { groupId },
                    select: {
                        createdAt: true,
                        user: { select: { id: true, name: true, email: true } },
                    },
                    orderBy: { createdAt: 'asc' },
                });

                return c.json({
                    administrators: [
                        {
                            id: group.owner.id,
                            name: group.owner.name,
                            email: group.owner.email,
                            role: 'owner' as const,
                            addedAt: null,
                        },
                        ...admins.map((admin) => ({
                            id: admin.user.id,
                            name: admin.user.name,
                            email: admin.user.email,
                            role: 'admin' as const,
                            addedAt: admin.createdAt,
                        })),
                    ],
                });
            });
        } catch (e) {
            if (e instanceof Response) return e;
            return c.json({ message: 'Unknown error' }, 500);
        }
    })
    .post(
        '/',
        zValidator('json', z.object({ email: z.string().email() })),
        async (c) => {
            const groupId = c.req.param('groupId');
            const { email } = c.req.valid('json');

            if (!groupId) return c.json({ message: 'Group ID is missing' }, 400);

            try {
                return await prisma.$transaction(async (tx) => {
                    const group = await tx.eventGroup.findUnique({
                        where: { id: groupId },
                        select: { ownerId: true },
                    });

                    if (!group) return c.json({ message: 'Event group not found' }, 404);

                    const user = await tx.user.findUnique({ where: { email } });
                    if (!user) return c.json({ message: 'User not found' }, 404);

                    if (user.id === group.ownerId) {
                        return c.json({ message: 'Owner is already administrator' }, 409);
                    }

                    const exists = await tx.eventGroupAdministrator.findUnique({
                        where: { groupId_userId: { groupId, userId: user.id } },
                    });

                    if (exists) {
                        return c.json({ message: 'Administrator already exists' }, 409);
                    }

                    const created = await tx.eventGroupAdministrator.create({
                        data: { groupId, userId: user.id },
                        select: {
                            createdAt: true,
                            user: { select: { id: true, name: true, email: true } },
                        },
                    });

                    return c.json({
                        message: 'Administrator added',
                        administrator: {
                            id: created.user.id,
                            name: created.user.name,
                            email: created.user.email,
                            role: 'admin' as const,
                            addedAt: created.createdAt,
                        },
                    }, 201);
                });
            } catch (e) {
                if (e instanceof Response) return e;
                return c.json({ message: 'Unknown error' }, 500);
            }
        },
    )
    .delete(
        '/',
        zValidator('json', z.object({ userId: z.string().cuid() })),
        async (c) => {
            const groupId = c.req.param('groupId');
            const { userId } = c.req.valid('json');

            if (!groupId) return c.json({ message: 'Group ID is missing' }, 400);

            try {
                return await prisma.$transaction(async (tx) => {
                    const group = await tx.eventGroup.findUnique({
                        where: { id: groupId },
                        select: { ownerId: true },
                    });

                    if (!group) return c.json({ message: 'Event group not found' }, 404);

                    if (userId === group.ownerId) {
                        return c.json({ message: 'Owner cannot be removed' }, 400);
                    }

                    const admin = await tx.eventGroupAdministrator.findUnique({
                        where: { groupId_userId: { groupId, userId } },
                    });

                    if (!admin) return c.json({ message: 'Administrator not found' }, 404);

                    await tx.eventGroupAdministrator.delete({
                        where: { groupId_userId: { groupId, userId } },
                    });

                    return c.json({ message: 'Administrator removed' }, 200);
                });
            } catch (e) {
                if (e instanceof Response) return e;
                return c.json({ message: 'Unknown error' }, 500);
            }
        },
    );

export default app;
