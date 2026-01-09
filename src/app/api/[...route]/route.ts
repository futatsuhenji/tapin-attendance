import { Hono } from 'hono';
import { handle } from 'hono/vercel';

import auth from './auth';
import event from './event';
import ping from './ping';

const app = new Hono().basePath('/api');
const route = app
    .route('/auth', auth)
    .route('/event', event)
    .route('/ping', ping);

export const GET = handle(route);
export const POST = handle(route);
export const PATCH = handle(route);
export const DELETE = handle(route);

export type AppType = typeof route;
