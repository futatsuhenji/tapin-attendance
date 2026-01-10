import { Hono } from 'hono';

import manage from './events/manage';
import respond from './events/respond';
import management from './events/management';
import detail from './events/detail';

const app = new Hono()
    .route('/:groupId/:eventId/manage', manage)
    .route('/:groupId/:eventId/respond', respond)
    .route('/:groupId', management)
    .route('/:groupId/:eventId', detail);

export default app;
