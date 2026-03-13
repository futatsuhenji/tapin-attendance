// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import { randomUUID } from 'node:crypto';

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { sha256 } from 'hono/utils/crypto';
import { z } from 'zod';

import { getPrismaClient } from '@/lib/prisma';
import { getRedisClient } from '@/lib/redis';
import { getJwtFromContext } from '@/utils/auth';
import { AttendanceType } from '@/generated/prisma/enums';

type RegisterPayload = {
    groupId: string;
    eventId: string;
    email: string;
    name: string;
};

const TOKEN_TTL_SECONDS = 60 * 10;

const registerPayloadSchema = z.object({
    groupId: z.string().cuid(),
    eventId: z.string().cuid(),
    email: z.email(),
    name: z.string().trim().min(1).max(120),
});

const toRegisterResultUrl = (groupId: string, eventId: string, status: string) =>
    `/event/${groupId}/${eventId}/register?status=${encodeURIComponent(status)}`;

async function issueRegistrationToken(payload: RegisterPayload): Promise<string> {
    const token = randomUUID();
    const redis = await getRedisClient();
    await redis.set(`event-registration:${await sha256(token)}`, JSON.stringify(payload), {
        expiration: { type: 'EX', value: TOKEN_TTL_SECONDS },
    });
    return token;
}

async function consumeRegistrationToken(token: string): Promise<RegisterPayload> {
    const lua = `
        local val = redis.call('GET', KEYS[1])
        if val then
            redis.call('DEL', KEYS[1])
        end
        return val
    `;

    const redis = await getRedisClient();
    const result = await redis.eval(lua, { keys: [`event-registration:${await sha256(token)}`] });

    if (typeof result !== 'string') {
        throw new TypeError('Registration token is invalid or expired');
    }

    return registerPayloadSchema.parse(JSON.parse(result));
}

const app = new Hono()
    .post(
        '/request',
        zValidator('json', z.object({
            email: z.email(),
            name: z.string().trim().min(1).max(120),
        })),
        async (c) => {
            const prisma = await getPrismaClient();
            const groupId = c.req.param('groupId');
            const eventId = c.req.param('eventId');
            const { email, name } = c.req.valid('json');

            if (!groupId || !eventId) return c.json({ message: 'Invalid parameters' }, 400);

            const event = await prisma.event.findUnique({
                where: { id: eventId },
                select: { groupId: true },
            });

            if (!event || event.groupId !== groupId) {
                return c.json({ message: 'Event not found' }, 404);
            }

            const registrationToken = await issueRegistrationToken({ groupId, eventId, email, name });
            return c.json({ registrationToken }, 201);
        },
    )
    .get(
        '/complete',
        zValidator('query', z.object({ token: z.string() })),
        async (c) => {
            const prisma = await getPrismaClient();
            const groupId = c.req.param('groupId');
            const eventId = c.req.param('eventId');
            const { token } = c.req.valid('query');

            if (!groupId || !eventId) return c.json({ message: 'Invalid parameters' }, 400);

            const jwt = await getJwtFromContext(c);
            if (!jwt?.user?.email) {
                return c.redirect(toRegisterResultUrl(groupId, eventId, 'unauthorized'));
            }

            let payload: RegisterPayload;
            try {
                payload = await consumeRegistrationToken(token);
            } catch (e) {
                console.error('Failed to consume registration token', e);
                return c.redirect(toRegisterResultUrl(groupId, eventId, 'token-invalid'));
            }

            if (payload.groupId !== groupId || payload.eventId !== eventId) {
                return c.redirect(toRegisterResultUrl(groupId, eventId, 'token-mismatch'));
            }

            if (payload.email.toLowerCase() !== jwt.user.email.toLowerCase()) {
                return c.redirect(toRegisterResultUrl(groupId, eventId, 'email-mismatch'));
            }

            const event = await prisma.event.findUnique({
                where: { id: eventId },
                select: { groupId: true },
            });
            if (!event || event.groupId !== groupId) {
                return c.redirect(toRegisterResultUrl(groupId, eventId, 'event-not-found'));
            }

            try {
                await prisma.$transaction(async (tx) => {
                    const user = await tx.user.upsert({
                        where: { email: payload.email },
                        update: { name: payload.name },
                        create: {
                            email: payload.email,
                            name: payload.name,
                        },
                        select: { id: true },
                    });

                    await tx.attendance.upsert({
                        where: { eventId_userId: { eventId, userId: user.id } },
                        create: {
                            eventId,
                            userId: user.id,
                            attendance: AttendanceType.PRESENCE,
                        },
                        update: {
                            attendance: AttendanceType.PRESENCE,
                        },
                    });

                    await tx.reception.upsert({
                        where: { eventId_visitorId: { eventId, visitorId: user.id } },
                        create: { eventId, visitorId: user.id, isRecepted: true },
                        update: { isRecepted: true },
                    });
                });
            } catch (e) {
                console.error('Failed to complete event registration', e);
                return c.redirect(toRegisterResultUrl(groupId, eventId, 'failed'));
            }

            return c.redirect(toRegisterResultUrl(groupId, eventId, 'completed'));
        },
    );

export default app;
