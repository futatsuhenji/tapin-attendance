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
            // events.ts から渡される :groupId
            const groupId = c.req.param('groupId');
            const {
                name, ownerId, description, place, mapUrl,
                startsAt, endsAt, publishedAt, registrationEndsAt, allowVisitorListSharing,
            } = c.req.valid('json');

            if (!groupId) return c.json({ message: 'Group ID is missing' }, 400);

            try {
                return await prisma.$transaction(async (tx) => {
                    const group = await tx.eventGroup.findUnique({ where: { id: groupId } });
                    if (!group) return c.json({ message: 'Event group not found' }, 404);

                    const user = await tx.user.findUnique({ where: { id: ownerId } });
                    if (!user) return c.json({ message: 'Owner user not found', userId: ownerId }, 404);

                    const event = await tx.event.create({
                        data: {
                            groupId, ownerId, name, description, place, mapUrl,
                            startsAt: startsAt ? new Date(startsAt) : null,
                            endsAt: endsAt ? new Date(endsAt) : null,
                            publishedAt: publishedAt ? new Date(publishedAt) : null,
                            registrationEndsAt: registrationEndsAt ? new Date(registrationEndsAt) : null,
                            allowVisitorListSharing: allowVisitorListSharing ?? false,
                        },
                    });
                    return c.json(event, 201);
                });
            } catch (e) {
                if (e instanceof Response) return e;
                return c.json({ message: 'Unknown error' }, 500);
            }
        },
    );

export default app;
