import { Hono } from 'hono';
import { handle } from 'hono/vercel';

import ping from './ping';

const app = new Hono().basePath('/api');
const route = app
    .route('/ping', ping);

export const GET = handle(route);
export const POST = handle(route);

export type AppType = typeof route;
