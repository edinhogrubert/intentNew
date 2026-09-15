import { z } from 'zod';

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const user = process.env.SQL_USER || process.env.SQL_ADMIN_USER;
  const password = process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD;
  const dbName = process.env.SQL_DB_NAME || 'cloud_sql_development_database';
  const host = process.env.SQL_HOST;

  if (user && password && host) {
    if (host.startsWith('/')) {
      return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost/${dbName}?host=${encodeURIComponent(host)}`;
    }
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${dbName}`;
  }

  return 'postgresql://user:pass@localhost:5432/intent';
}

function resolveFirebaseProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID;
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      if (sa.project_id) return sa.project_id;
    } catch {
      // ignore
    }
  }
  return 'intent-86155';
}

const defaultDevKey = Buffer.alloc(32, 1).toString('base64');

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().default(resolveDatabaseUrl()),
  FIREBASE_PROJECT_ID: z.string().default(resolveFirebaseProjectId()),
  REVEAL_ENCRYPTION_KEY: z.string().default(process.env.REVEAL_ENCRYPTION_KEY || defaultDevKey),
});

const parsed = environmentSchema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Configuração inválida. Verifique: ${missing}`);
}

let encryptionKey: Buffer;
try {
  encryptionKey = Buffer.from(parsed.data.REVEAL_ENCRYPTION_KEY, 'base64');
  if (encryptionKey.length !== 32) {
    encryptionKey = Buffer.alloc(32, 1);
  }
} catch {
  encryptionKey = Buffer.alloc(32, 1);
}

export const config = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  logLevel: parsed.data.LOG_LEVEL,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean),
  databaseUrl: parsed.data.DATABASE_URL,
  firebaseProjectId: parsed.data.FIREBASE_PROJECT_ID,
  revealEncryptionKey: encryptionKey,
};

