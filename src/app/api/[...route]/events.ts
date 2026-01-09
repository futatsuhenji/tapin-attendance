import { Hono } from 'hono';

import manage from './events/manage';

const app = new Hono()
    .route('/:groupId/:eventId/manage', manage);

export default app;
