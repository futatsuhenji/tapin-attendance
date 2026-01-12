// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import { Hono } from 'hono';

import email from './auth/email';

const app = new Hono()
    .route('/email', email);

export default app;
