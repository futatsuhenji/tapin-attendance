import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';


const app = new Hono()
    .get('/', async (c) => {
        const groupId = c.req.param('groupId')!;
        const eventId = c.req.param('eventId')!;

        return await prisma.$transaction(async (tx) => {
            if (!(await tx.eventGroup.findUnique({ where: { id: groupId } }))) {
                return c.json({ message: 'Event group not found' }, 404);
            }

            const event = await tx.event.findUnique({
                where: { id: eventId },
                select: {
                    ownerId: true,
                    owner: { select: { id: true, name: true, email: true } },
                },
            });

            if (!event) {
                return c.json({ message: 'Event not found' }, 404);
            }

            const admins = await tx.eventAdministrator.findMany({
                where: { eventId },
                select: {
                    createdAt: true,
                    user: { select: { id: true, name: true, email: true } },
                },
                orderBy: { createdAt: 'asc' },
            });

            return c.json({
                administrators: [
                    {
                        id: event.owner.id,
                        name: event.owner.name,
                        email: event.owner.email,
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
    })
    .post(
        '/',
        zValidator('json', z.object({ email: z.string().email() })),
        async (c) => {
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            const { email } = c.req.valid('json');

            return await prisma.$transaction(async (tx) => {
                if (!(await tx.eventGroup.findUnique({ where: { id: groupId } }))) {
                    return c.json({ message: 'Event group not found' }, 404);
                }

                const event = await tx.event.findUnique({
                    where: { id: eventId },
                    select: { ownerId: true },
                });

                if (!event) {
                    return c.json({ message: 'Event not found' }, 404);
                }

                const user = await tx.user.findUnique({ where: { email } });
                if (!user) {
                    return c.json({ message: 'User not found' }, 404);
                }

                if (user.id === event.ownerId) {
                    return c.json({ message: 'Owner is already administrator' }, 409);
                }

                const exists = await tx.eventAdministrator.findUnique({
                    where: { eventId_userId: { eventId, userId: user.id } },
                });

                if (exists) {
                    return c.json({ message: 'Administrator already exists' }, 409);
                }

                const created = await tx.eventAdministrator.create({
                    data: { eventId, userId: user.id },
                    select: {
                        createdAt: true,
                        user: { select: { id: true, name: true, email: true } },
                    },
                });

                // 管理者を attendance に登録
                await tx.attendance.upsert({
                    where: { eventId_userId: { eventId, userId: user.id } },
                    create: { eventId, userId: user.id },
                    update: {},
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
        },
    )
    .delete(
        '/',
        zValidator('json', z.object({ userId: z.string().cuid() })),
        async (c) => {
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            const { userId } = c.req.valid('json');

            return await prisma.$transaction(async (tx) => {
                if (!(await tx.eventGroup.findUnique({ where: { id: groupId } }))) {
                    return c.json({ message: 'Event group not found' }, 404);
                }

                const event = await tx.event.findUnique({
                    where: { id: eventId },
                    select: { ownerId: true },
                });

                if (!event) {
                    return c.json({ message: 'Event not found' }, 404);
                }

                if (userId === event.ownerId) {
                    return c.json({ message: 'Owner cannot be removed' }, 400);
                }

                const admin = await tx.eventAdministrator.findUnique({
                    where: { eventId_userId: { eventId, userId } },
                });

                if (!admin) {
                    return c.json({ message: 'Administrator not found' }, 404);
                }

                await tx.eventAdministrator.delete({
                    where: { eventId_userId: { eventId, userId } },
                });

                return c.json({ message: 'Administrator removed' }, 200);
            });
        },
    );

export default app;
