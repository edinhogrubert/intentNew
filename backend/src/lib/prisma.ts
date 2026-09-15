import { PrismaClient } from '@prisma/client';

export function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const user = process.env.SQL_USER || process.env.SQL_ADMIN_USER;
  const password = process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD;
  const dbName = process.env.SQL_DB_NAME || 'cloud_sql_development_database';
  const host = process.env.SQL_HOST;

  if (user && password && host) {
    let url: string;
    if (host.startsWith('/')) {
      url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost/${dbName}?host=${encodeURIComponent(host)}`;
    } else {
      url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${dbName}`;
    }
    process.env.DATABASE_URL = url;
    return url;
  }

  return process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/intent';
}

const dbUrl = getDatabaseUrl();

export const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});


