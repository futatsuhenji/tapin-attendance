import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

const app = new Hono()
    .get('/',
        async (c) => {
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            return await prisma.$transaction(async (tx) => {
                if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                    if (await tx.event.findUnique({ where: { id: eventId } })) {
                        const mail = await tx.eventMail.findUnique({ select: { title: true, content: true }, where: { eventId } });
                        return mail ? c.json(mail) : c.json({ message: 'Mail not found' }, 404);
                    } else {
                        return c.json({ message: 'Event not found' }, 404);
                    }
                } else {
                    return c.json({ message: 'Event group not found' }, 404);
                }
            });
        },
    )
    .post('/',
        zValidator('json', z.object({
            title: z.string(),
            content: z.string(),
        })),
        async (c) => {
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            const { title, content } = c.req.valid('json');
            return await prisma.$transaction(async (tx) => {
                if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                    if (await tx.event.findUnique({ where: { id: eventId } })) {
                        try {
                            await tx.eventMail.create({ data: { eventId, title, content } });
                        } catch (e) {
                            // eslint-disable-next-line unicorn/prefer-ternary
                            if (e instanceof Error && e.name === 'P2002') {
                                return c.json({ message: 'Mail already exists' }, 409);
                            } else {
                                return c.json({ message: 'Unknown error' }, 500);
                            }
                        }
                        return c.json({ message: 'Mail created' }, 201);
                    } else {
                        return c.json({ message: 'Event not found' }, 404);
                    }
                } else {
                    return c.json({ message: 'Event group not found' }, 404);
                }
            });
        },
    )
    .patch('/',
        zValidator('json', z.object({
            title: z.string().optional(),
            content: z.string().optional(),
        })),
        async (c) => {
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            const { title, content } = c.req.valid('json');
            // eslint-disable-next-line sonarjs/cognitive-complexity
            return await prisma.$transaction(async (tx) => {
                if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                    if (await tx.event.findUnique({ where: { id: eventId } })) {
                        const mail = await tx.eventMail.findUnique({ where: { eventId } });
                        if (mail) {
                            const data: { title?: string; content?: string } = {};
                            if (title) data.title = title;
                            if (content) data.content = content;
                            await tx.eventMail.update({ where: { eventId }, data });
                            return c.json({ message: 'Mail updated' }, 200);
                        } else {
                            return c.json({ message: 'Mail not found' }, 404);
                        }
                    } else {
                        return c.json({ message: 'Event not found' }, 404);
                    }
                } else {
                    return c.json({ message: 'Event group not found' }, 404);
                }
            });
        },
    )
    .delete('/',
        async (c) => {
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            return await prisma.$transaction(async (tx) => {
                if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                    if (await tx.event.findUnique({ where: { id: eventId } })) {
                        const mail = await tx.eventMail.findUnique({ where: { eventId } });
                        if (mail) {
                            await tx.eventMail.delete({ where: { eventId } });
                            return c.json({ message: 'Mail deleted' }, 200);
                        } else {
                            return c.json({ message: 'Mail not found' }, 404);
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
