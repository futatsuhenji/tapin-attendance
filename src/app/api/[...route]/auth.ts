import { Hono } from 'hono';

import email from './auth/email';

const app = new Hono()
    .route('/email', email);

export default app;
