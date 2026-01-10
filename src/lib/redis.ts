import { createClient } from 'redis';

import type { RedisClientType } from 'redis';


const globalForRedis = globalThis as unknown as { redis: RedisClientType };


export async function getRedisClient(): Promise<RedisClientType> {
    if (!process.env.REDIS_URL) {
        throw new Error('REDIS_URL is not defined');
    }
    if (!globalForRedis.redis) {
        globalForRedis.redis = await createClient({ url: process.env.REDIS_URL })
            .on('error', async (e) => {
                console.error('Redis Client Error:', e);
            })
            .connect() as RedisClientType; // XXX: 戻り値の型をキャスト
    }
    return globalForRedis.redis;
}
