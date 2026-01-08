import { Hono } from 'hono';

import manage from './event/manage';
import ping from './ping';

const app = new Hono()
    .route('/:groupId/:eventId/manage', manage)
    .route('/ping', ping);

export default app;
