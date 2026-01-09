import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';


const app = new Hono()
    .get('/', async (c) => {
        const groupId = c.req.param('groupId')!;
        const eventId = c.req.param('eventId')!;
        return await prisma.$transaction(async (tx) => {
            if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                if (await tx.event.findUnique({ where: { id: eventId } })) {
                    const members = await tx.attendance.findMany({
                        select: { user: {
                            select: { id: true, name: true, email: true },
                        } },
                        where: { eventId },
                    });
                    return c.json({ members });
                } else {
                    return c.json({ message: 'Event not found' }, 404);
                }
            } else {
                return c.json({ message: 'Event group not found' }, 404);
            }
        });
    })
    .post(
        '/',
        zValidator('json', z.object({ userIds: z.cuid().array() })),
        async (c) => {
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            const { userIds } = c.req.valid('json');
            const alreadyAdded: string[] = [];
            try {
                // eslint-disable-next-line sonarjs/cognitive-complexity
                return await prisma.$transaction(async (tx) => {
                    if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                        if (await tx.event.findUnique({ where: { id: eventId } })) {
                            for (const userId of userIds) {
                                if (await tx.user.findUnique({ where: { id: userId } })) {
                                    if (!(await tx.attendance.findUnique({ where: { eventId_userId: { eventId, userId } } }))) {
                                        await tx.attendance.create({ data: { eventId, userId } });
                                    } else {
                                        alreadyAdded.push(userId);
                                    }
                                } else {
                                    throw c.json({ message: 'User not found', user: { id: userId } }, 404);
                                }
                            }
                            // eslint-disable-next-line unicorn/prefer-ternary
                            if (alreadyAdded.length > 0) {
                                return c.json({
                                    message: 'Members added while some members were already added',
                                    ignored: alreadyAdded,
                                }, 201);
                            } else {
                                return c.json({ message: 'Members added' }, 201);
                            }
                        } else {
                            return c.json({ message: 'Event not found' }, 404);
                        }
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
    .delete('/',
        zValidator('json', z.object({ userId: z.cuid() })),
        async (c) => {
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            const { userId } = c.req.valid('json');
            return await prisma.$transaction(async (tx) => {
                if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                    if (await tx.event.findUnique({ where: { id: eventId } })) {
                        if (await tx.user.findUnique({ where: { id: userId } })) {
                            const attendance = await tx.attendance.findUnique({ where: { eventId_userId: { eventId, userId } } });
                            if (attendance) {
                                await tx.attendance.delete({ where: { eventId_userId: { eventId, userId } } });
                                return c.json({ message: 'Member removed' }, 200);
                            } else {
                                return c.json({ message: 'Member not found' }, 404);
                            }
                        } else {
                            return c.json({ message: 'User not found' }, 404);
                        }
                    } else {
                        return c.json({ message: 'Event not found' }, 404);
                    }
                } else {
                    return c.json({ message: 'Event group not found' }, 404);
                }
            });
        },
    );

export default app;
