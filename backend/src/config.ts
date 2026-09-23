import { z } from 'zod';
import { resolveDatabaseUrl } from './lib/db-url.js';


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

const envCors = parsed.data.CORS_ORIGINS.split(',')
  .map((value) => value.trim().replace(/\/+$/, ''))
  .filter((origin) => origin.length > 0 && origin !== '*');

const allowedOriginsSet = new Set<string>([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...envCors,
]);

if (process.env.APP_URL) {
  const appUrl = process.env.APP_URL.trim().replace(/\/+$/, '');
  if (appUrl) {
    allowedOriginsSet.add(appUrl);
  }
}

// URL do ambiente compartilhado (Shared App Preview) via variável de ambiente opcional
if (process.env.SHARED_APP_URL) {
  const sharedUrl = process.env.SHARED_APP_URL.trim().replace(/\/+$/, '');
  if (sharedUrl) {
    allowedOriginsSet.add(sharedUrl);
  }
}

export const config = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  logLevel: parsed.data.LOG_LEVEL,
  corsOrigins: Array.from(allowedOriginsSet),
  databaseUrl: parsed.data.DATABASE_URL,
  firebaseProjectId: parsed.data.FIREBASE_PROJECT_ID,
  revealEncryptionKey: encryptionKey,
};

