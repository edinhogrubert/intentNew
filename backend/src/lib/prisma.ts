import { PrismaClient } from '@prisma/client';
import { resolveDatabaseUrl } from './db-url.js';

export { resolveDatabaseUrl as getDatabaseUrl };

export function isTransientDbError(error: unknown): boolean {
  if (!error) return false;
  const msg = typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message) : '';
  const code = typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : '';
  return (
    code === 'P1001' ||
    code === 'P1017' ||
    code === 'E57P01' ||
    msg.includes('57P01') ||
    msg.includes('terminating connection due to administrator command') ||
    msg.includes('connection closed') ||
    msg.includes('Connection reset') ||
    msg.includes('ECONNRESET') ||
    msg.includes('Closed connection') ||
    msg.includes('broken pipe')
  );
}

function createPrismaClient() {
  const dbUrl = resolveDatabaseUrl();
  const rawClient = new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  return rawClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ query, args }) {
          try {
            return await query(args);
          } catch (error) {
            if (isTransientDbError(error)) {
              try {
                await rawClient.$disconnect();
                await new Promise((resolve) => setTimeout(resolve, 250));
                await rawClient.$connect();
                return await query(args);
              } catch (retryError) {
                throw isTransientDbError(retryError) ? retryError : error;
              }
            }
            throw error;
          }
        },
      },
    },
  });
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

// Global/singleton instance
const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

