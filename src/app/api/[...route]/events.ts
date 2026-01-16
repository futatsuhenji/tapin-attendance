// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-FileCopyrightText: 2026 Yu Yokoyama <25w6105e@shinshu-u.ac.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import { Hono } from 'hono';

import manage from './events/manage';
import respond from './events/respond';
import management from './events/management';
import detail from './events/detail';
import open from './events/open';

const app = new Hono()
    .route('/:groupId/:eventId/manage', manage)
    .route('/:groupId/:eventId/respond', respond)
    .route('/:groupId/:eventId/open', open)
    .route('/:groupId', management)
    .route('/:groupId/:eventId', detail);

export default app;
