// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { getPrismaClient } from '@/lib/prisma';


const smtpSchema = z.object({
    enabled: z.boolean(),
    host: z.string().trim().min(1).optional(),
    port: z.number().int().positive().optional(),
    secure: z.boolean().optional(),
    user: z.string().trim().min(1).optional(),
    password: z.string().trim().min(1).optional(),
    fromName: z.string().trim().max(255).optional(),
    fromEmail: z.email().optional(),
});


const app = new Hono()
    .get('/', async (c) => {
        const prisma = await getPrismaClient();
        const groupId = c.req.param('groupId');
        const eventId = c.req.param('eventId');

        if (!groupId || !eventId) return c.json({ message: 'Invalid parameters' }, 400);

        return await prisma.$transaction(async (tx) => {
            if (!(await tx.eventGroup.findUnique({ where: { id: groupId } }))) {
                return c.json({ message: 'Event group not found' }, 404);
            }

            const event = await tx.event.findUnique({ where: { id: eventId }, select: { id: true, groupId: true } });
            if (!event || event.groupId !== groupId) {
                return c.json({ message: 'Event not found' }, 404);
            }

            const setting = await tx.eventSmtpSetting.findUnique({
                where: { eventId },
                select: {
                    host: true,
                    port: true,
                    secure: true,
                    user: true,
                    password: true,
                    fromName: true,
                    fromEmail: true,
                },
            });

            if (!setting) return c.json({ enabled: false, hasPassword: false });

            return c.json({
                enabled: true,
                host: setting.host,
                port: setting.port,
                secure: setting.secure,
                user: setting.user,
                fromName: setting.fromName,
                fromEmail: setting.fromEmail,
                hasPassword: Boolean(setting.password),
            });
        });
    })
    .put('/', zValidator('json', smtpSchema), async (c) => {
        const prisma = await getPrismaClient();
        const groupId = c.req.param('groupId');
        const eventId = c.req.param('eventId');
        const payload = c.req.valid('json');

        if (!groupId || !eventId) return c.json({ message: 'Invalid parameters' }, 400);

        return await prisma.$transaction(async (tx) => {
            if (!(await tx.eventGroup.findUnique({ where: { id: groupId } }))) {
                return c.json({ message: 'Event group not found' }, 404);
            }

            const event = await tx.event.findUnique({ where: { id: eventId }, select: { id: true, groupId: true } });
            if (!event || event.groupId !== groupId) {
                return c.json({ message: 'Event not found' }, 404);
            }

            if (!payload.enabled) {
                await tx.eventSmtpSetting.deleteMany({ where: { eventId } });
                return c.json({ message: 'SMTP setting disabled' }, 200);
            }

            const existing = await tx.eventSmtpSetting.findUnique({ where: { eventId } });

            const host = payload.host?.trim() || existing?.host;
            const port = payload.port ?? existing?.port;
            const user = payload.user?.trim() || existing?.user;
            const password = payload.password?.trim() || existing?.password;
            const secure = payload.secure ?? existing?.secure ?? true;
            const fromName = payload.fromName !== undefined ? (payload.fromName.trim() || null) : existing?.fromName ?? null;
            const fromEmail = payload.fromEmail !== undefined ? (payload.fromEmail.trim() || null) : existing?.fromEmail ?? null;

            if (!host || !port || !user || !password) {
                return c.json({ message: 'host, port, user and password are required' }, 400);
            }

            await tx.eventSmtpSetting.upsert({
                where: { eventId },
                create: { eventId, host, port, secure, user, password, fromName, fromEmail },
                update: { host, port, secure, user, password, fromName, fromEmail },
            }); // TODO: パスワードの暗号化

            return c.json({ message: 'SMTP setting saved' }, 200);
        });
    });

export default app;
