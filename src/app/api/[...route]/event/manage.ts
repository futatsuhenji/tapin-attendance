import { Hono } from 'hono';

import invitation from './manage/invitation';

const app = new Hono()
    .route('/invitation', invitation);

export default app;
