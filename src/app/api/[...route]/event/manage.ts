import { Hono } from 'hono';

import invitation from './manage/invitation';
import members from './manage/members';

const app = new Hono()
    .route('/invitation', invitation)
    .route('/members', members);

export default app;
