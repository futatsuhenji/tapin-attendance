// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { getPrismaClient } from '@/lib/prisma';
import { getJwtFromContext } from '@/utils/auth';

const app = new Hono()
    .get('/', async (c) => {
        const jwt = await getJwtFromContext(c);
        if (!jwt) {
            return c.json({ message: 'Unauthorized' }, 401);
        }

        try {
            const prisma = await getPrismaClient();
            const user = await prisma.user.findUnique({
                where: { id: jwt.user.id },
                select: { id: true, email: true, name: true },
            });

            if (!user) {
                return c.json({ message: 'User not found' }, 404);
            }

            return c.json({ user }, 200);
        } catch (e) {
            if (e instanceof Response) return e;
            console.error('Failed to fetch current user:', e);
            return c.json({ message: 'Internal Server Error' }, 500);
        }
    })
    .patch(
        '/',
        zValidator('json', z.object({ name: z.string().min(1, '名前を入力してください').max(100, '名前が長すぎます') })),
        async (c) => {
            const jwt = await getJwtFromContext(c);
            if (!jwt) {
                return c.json({ message: 'Unauthorized' }, 401);
            }

            const prisma = await getPrismaClient();
            const { name } = c.req.valid('json');
            const trimmedName = name.trim();

            if (!trimmedName) {
                return c.json({ message: '名前を入力してください' }, 400);
            }

            try {
                const user = await prisma.user.update({
                    where: { id: jwt.user.id },
                    data: { name: trimmedName },
                    select: { id: true, email: true, name: true },
                });

                return c.json({ user }, 200);
            } catch (e) {
                if (e instanceof Response) return e;
                console.error('Failed to update user name:', e);
                return c.json({ message: 'Internal Server Error' }, 500);
            }
        },
    );

export default app;
