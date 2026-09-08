import { randomBytes } from 'node:crypto';
import { defineConfig } from 'vitest/config';

// Integration tests create fixtures and test-only triggers. Never accept an
// implicit production DATABASE_URL or a database outside the test namespace.
const value = process.env.TEST_DATABASE_URL;
if (!value) throw new Error('Informe TEST_DATABASE_URL para um banco descartável intent_test_*.');
const url = new URL(value);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/intent_test_[a-z0-9_]+$/.test(url.pathname)) {
  throw new Error('Os testes exigem PostgreSQL local em um banco descartável intent_test_*.');
}
process.env.DATABASE_URL = value;
process.env.NODE_ENV = 'test';
process.env.FIREBASE_PROJECT_ID = 'synthetic-integration-test';
process.env.REVEAL_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.LOG_LEVEL = 'silent';

export default defineConfig({ test: {
  include: ['tests-postgres/**/*.test.ts'], environment: 'node',
  testTimeout: 15000, hookTimeout: 30000, fileParallelism: false,
} });
