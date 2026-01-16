// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { Hono } from 'hono';

import { getPrismaClient } from '@/lib/prisma';

const LOGO_HEADERS = {
    'Content-Type': 'image/png',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
};

let cachedLogo: Uint8Array<ArrayBuffer> | null = null;

async function getLogoImage(): Promise<Uint8Array<ArrayBuffer>> {
    if (!cachedLogo) {
        const logoPath = path.join(process.cwd(), 'public', 'logo.png');
        const buffer = await readFile(logoPath);
        cachedLogo = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
    return cachedLogo;
}

const app = new Hono()
    .get('/', async (c) => {
        const prisma = await getPrismaClient();
        const token = c.req.query('token');

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

        const logo = await getLogoImage();
        return c.body(logo, 200, {
            ...LOGO_HEADERS,
            'Content-Length': `${logo.byteLength}`,
        });
    });

export default app;
