import { Hono } from 'hono';

import manage from './events/manage';
import respond from './events/respond';

const app = new Hono()
    .route('/:groupId/:eventId/manage', manage)
    .route('/:groupId/:eventId/respond', respond);

export default app;
