import { createClient } from 'redis';

import { getEnvironmentValueOrThrow } from '@/utils/environ';

import type { RedisClientType } from 'redis';


const globalForRedis = globalThis as unknown as { redis: RedisClientType };


export async function getRedisClient(): Promise<RedisClientType> {
    if (!globalForRedis.redis) {
        globalForRedis.redis = await createClient({ url: await getEnvironmentValueOrThrow('REDIS_URL') })
            .on('error', async (e) => {
                console.error('Redis Client Error:', e);
            })
            .connect() as RedisClientType; // XXX: 戻り値の型をキャスト
    }
    return globalForRedis.redis;
}
