import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { getEnvironmentValueOrThrow } from '@/utils/environ';

export { PrismaClientKnownRequestError } from '@/generated/prisma/internal/prismaNamespace';
export type { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';


const globalForPrisma = globalThis as unknown as {
    prisma?: PrismaClient;
};


export async function getPrismaClient(): Promise<PrismaClient> {
    if (!globalForPrisma.prisma) {
        const pool = new Pool({
            connectionString: await getEnvironmentValueOrThrow('DATABASE_URL'),
        });
        const adapter = new PrismaPg(pool);

        const prismaClient = new PrismaClient({
            adapter,
            log: process.env.NODE_ENV !== 'production' ? ['info', 'warn', 'error'] : ['query', 'info', 'warn', 'error'],
        });


        globalForPrisma.prisma = prismaClient;
    }



    return globalForPrisma.prisma;
}
