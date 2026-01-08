import { createClient } from 'redis';

import type { RedisClientType } from 'redis';


const globalForRedis = globalThis as unknown as { redis: RedisClientType };


export const redis =
    globalForRedis.redis ||
    process.env.REDIS_URL === undefined ?
        new Proxy({} as RedisClientType, { // プリレンダリング対策
            get() {
                throw new Error('REDIS_URL is not defined');
            },
        }) :
        await createClient({ url: process.env.REDIS_URL })
            .on('error', async (e) => {
                console.error('Redis Client Error:', e);
            })
            .connect() as RedisClientType; // XXX: 戻り値の型をキャスト


if (process.env.NODE_ENV !== 'production') {
    globalForRedis.redis = redis;
}
