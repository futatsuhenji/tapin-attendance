// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono()
    .get('/', (c) => c.json({ message: 'pong' }))
    .post(
        '/',
        zValidator('json', z.object({ message: z.string() })),
        (c) => {
            const { message } = c.req.valid('json');
            return c.json({ message: message });
        },
    );

export default app;
