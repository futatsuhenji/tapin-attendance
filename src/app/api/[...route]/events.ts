import { Hono } from 'hono';

import manage from './events/manage';
import create from './events/create';
import detail from './events/detail';

const app = new Hono()
    .route('/:groupId/:eventId/manage', manage)
    .route('/:groupId', create)
    .route('/:groupId/:eventId', detail);

export default app;
