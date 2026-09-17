import { PrismaClient } from '@prisma/client';
import { resolveDatabaseUrl } from './db-url.js';

export { resolveDatabaseUrl as getDatabaseUrl };

const dbUrl = resolveDatabaseUrl();

export const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
