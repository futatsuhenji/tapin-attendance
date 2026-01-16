// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-FileCopyrightText: 2026 Yu Yokoyama <25w6105e@shinshu-u.ac.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import { Hono } from 'hono';
import { handle } from 'hono/vercel';

import auth from './auth';
import events from './events';
import ping from './ping';
import groups from './groups';
import me from './me';

const app = new Hono().basePath('/api');
const route = app
    .route('/auth', auth)
    .route('/events', events)
    .route('/ping', ping)
    .route('/groups', groups)
    .route('/me', me);

export const GET = handle(route);
export const POST = handle(route);
export const PATCH = handle(route);
export const PUT = handle(route);
export const DELETE = handle(route);

export type AppType = typeof route;
