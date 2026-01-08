import { hc } from 'hono/client';

import type { AppType } from '@/app/api/[...route]/route';

export const honoClient = hc<AppType>(
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
);
