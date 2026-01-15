import { hc } from 'hono/client';

import type { AppType } from '@/app/api/[...route]/route';

console.log('Hono client initialized with URL:', process.env.NEXT_PUBLIC_APP_URL);

export const honoClient = hc<AppType>('/');
