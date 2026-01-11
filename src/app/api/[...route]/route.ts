import { Hono } from 'hono';
import { handle } from 'hono/vercel';

import auth from './auth';
import events from './events';
import ping from './ping';
import groups from './groups';

const app = new Hono().basePath('/api');
const route = app
    .route('/auth', auth)
    .route('/events', events)
    .route('/ping', ping)
    .route('/groups', groups);

export const GET = handle(route);
export const POST = handle(route);
export const PATCH = handle(route);
export const DELETE = handle(route);

export type AppType = typeof route;
