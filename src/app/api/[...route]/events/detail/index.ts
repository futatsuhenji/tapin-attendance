import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

const app = new Hono()
    .get('/', async (c) => {
        const groupId = c.req.param('groupId');
        const eventId = c.req.param('eventId');

        if (!groupId || !eventId) return c.json({ message: 'Invalid parameters' }, 400);

        try {
            const event = await prisma.event.findUnique({ where: { id: eventId } });
            return event && event.groupId === groupId
                ? c.json(event, 200)
                : c.json({ message: 'Event not found' }, 404);
        } catch (e) {
            if (e instanceof Response) return e;
            return c.json({ message: 'Unknown error' }, 500);
        }
    })
    .patch(
        '/',
        zValidator('json', z.object({
            name: z.string().min(1).optional(),
            description: z.string().optional(),
            place: z.string().optional(),
            mapUrl: z.string().url().optional().or(z.literal('')),
            startsAt: z.string().datetime().optional(),
            endsAt: z.string().datetime().optional(),
            publishedAt: z.string().datetime().optional(),
            registrationEndsAt: z.string().datetime().optional(),
            allowVisitorListSharing: z.boolean().optional(),
        })),
        async (c) => {
            const groupId = c.req.param('groupId');
            const eventId = c.req.param('eventId');
            const data = c.req.valid('json');

            if (!groupId || !eventId) return c.json({ message: 'Invalid parameters' }, 400);

            try {
                return await prisma.$transaction(async (tx) => {
                    const event = await tx.event.findUnique({ where: { id: eventId } });
                    if (!event || event.groupId !== groupId) {
                        return c.json({ message: 'Event not found' }, 404);
                    }
                    const updatedEvent = await tx.event.update({
                        where: { id: eventId },
                        data: {
                            ...data,
                            startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
                            endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
                            publishedAt: data.publishedAt ? new Date(data.publishedAt) : undefined,
                            registrationEndsAt: data.registrationEndsAt ? new Date(data.registrationEndsAt) : undefined,
                        },
                    });
                    return c.json(updatedEvent, 200);
                });
            } catch (e) {
                if (e instanceof Response) return e;
                return c.json({ message: 'Unknown error' }, 500);
            }
        },
    )
    .delete('/', async (c) => {
        const groupId = c.req.param('groupId');
        const eventId = c.req.param('eventId');

        if (!groupId || !eventId) return c.json({ message: 'Invalid parameters' }, 400);

        try {
            return await prisma.$transaction(async (tx) => {
                const event = await tx.event.findUnique({ where: { id: eventId } });
                if (!event || event.groupId !== groupId) {
                    return c.json({ message: 'Event not found' }, 404);
                }
                await tx.event.delete({ where: { id: eventId } });
                return c.json({ message: 'Event deleted' }, 200);
            });
        } catch (e) {
            if (e instanceof Response) return e;
            return c.json({ message: 'Unknown error' }, 500);
        }
    });

export default app;
