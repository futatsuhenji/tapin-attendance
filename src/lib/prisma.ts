import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

export { PrismaClientKnownRequestError } from '@/generated/prisma/internal/prismaNamespace';
export type { TransactionClient } from '@/generated/prisma/internal/prismaNamespace';


const globalForPrisma = globalThis as unknown as {
    prisma?: PrismaClient;
};


export const prisma =
    globalForPrisma.prisma ??
    (() => {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
        });

        const adapter = new PrismaPg(pool);

        return new PrismaClient({
            adapter,
            log: process.env.NODE_ENV !== 'production' ? ['info', 'warn', 'error'] : ['query', 'info', 'warn', 'error'],
        });
    })();


if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
