import { Hono } from 'hono';

import invitation from './manage/invitation';
import members from './manage/members';
import administrators from './manage/administrators';

const app = new Hono()
    .route('/invitation', invitation)
    .route('/members', members)
    .route('/administrators', administrators);

export default app;
