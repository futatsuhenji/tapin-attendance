// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import { Hono } from 'hono';

import { getPrismaClient } from '@/lib/prisma';

// 1x1 transparent GIF
const TRANSPARENT_PIXEL = Uint8Array.from([
    71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 255, 255, 255, 0, 0, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 68, 1, 0, 59,
]);

const PIXEL_HEADERS = {
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Content-Length': `${TRANSPARENT_PIXEL.byteLength}`,
};

const app = new Hono()
    .get('/', async (c) => {
        const prisma = await getPrismaClient();
        console.log('Mail open tracking requested');
        const token = c.req.query('token');
        console.log('Mail open tracking requested with token:', token);

        if (token) {
            try {
                await prisma.attendance.updateMany({
                    where: {
                        secret: token,
                    },
                    data: {
                        isMailOpened: true,
                    },
                });
            } catch (e) {
                console.error('Failed to record mail open', e);
            }
        } else {
            console.warn('Missing parameters for mail open tracking');
        }

        return c.body(TRANSPARENT_PIXEL, 200, PIXEL_HEADERS);
    });

export default app;
