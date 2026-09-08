import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Real app, routes, authentication middleware and feed services; no external I/O.
const { db, verifyIdToken } = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    intent: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
    domainEvent: { create: vi.fn() },
    follow: { findUnique: vi.fn() },
    support: { findUnique: vi.fn() },
  },
  verifyIdToken: vi.fn(),
}));
vi.mock('../src/lib/prisma.js', () => ({ prisma: db }));
vi.mock('../src/lib/firebase.js', () => ({ firebaseAuth: { verifyIdToken } }));
vi.mock('../src/config.js', () => ({ config: {
  corsOrigins: ['http://localhost:3000'], logLevel: 'silent', revealEncryptionKey: Buffer.alloc(32, 7),
} }));

import { createApp } from '../src/app.js';

const viewer = { id: '10000000-0000-4000-8000-000000000002', firebaseUid: 'test-viewer', username: 'visitante', status: 'ACTIVE' };
const creatorId = '10000000-0000-4000-8000-000000000001';
const intentId = '20000000-0000-4000-8000-000000000001';
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server = createApp().listen(0, '127.0.0.1', () => resolve());
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
});

beforeEach(() => {
  vi.resetAllMocks();
  verifyIdToken.mockResolvedValue({ uid: viewer.firebaseUid, name: 'Visitante' });
  db.user.findUnique.mockResolvedValue(viewer);
  db.user.update.mockResolvedValue(viewer);
  db.intent.findMany.mockResolvedValue([]);
  db.follow.findUnique.mockResolvedValue(null);
  db.support.findUnique.mockResolvedValue(null);
});

function get(path: string, authorization?: string) {
  return fetch(`${baseUrl}${path}`, { headers: authorization ? { authorization } : {} });
}

describe('regressão HTTP dos feeds e autenticação', () => {
  it.each(['/v1/intents/feed', '/v1/intents/feed?scope=public'])('Para você permite leitura anônima (%s)', async (path) => {
    const response = await get(path);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { items: [], nextCursor: null } });
    expect(db.intent.findMany.mock.calls[0]![0].where.visibility).toBe('PUBLIC');
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('Seguindo exige autenticação mesmo sem dados no feed', async () => {
    const response = await get('/v1/intents/feed?scope=following');
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'AUTH_REQUIRED' } });
    expect(db.intent.findMany).not.toHaveBeenCalled();
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it('Seguindo usa o usuário autenticado, ignorando identidade fornecida na query', async () => {
    const response = await get(`/v1/intents/feed?scope=following&viewerId=${creatorId}`, 'Bearer synthetic-test-token');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { items: [], nextCursor: null } });
    expect(verifyIdToken).toHaveBeenCalledWith('synthetic-test-token', true);
    expect(db.intent.findMany.mock.calls[0]![0].where.creator).toEqual({ status: 'ACTIVE', followers: { some: { followerId: viewer.id } } });
  });

  it('rejeita token inválido ou revogado sem consultar Intents', async () => {
    verifyIdToken.mockRejectedValue(new Error('synthetic invalid token'));
    const response = await get('/v1/intents/feed?scope=following', 'Bearer invalid-test-token');
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'AUTH_INVALID' } });
    expect(verifyIdToken).toHaveBeenCalledWith('invalid-test-token', true);
    expect(db.intent.findMany).not.toHaveBeenCalled();
  });

  it('rejeita autenticação com formato incorreto', async () => {
    const response = await get('/v1/intents/feed?scope=following', 'Basic invalid-test-token');
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'AUTH_INVALID' } });
    expect(verifyIdToken).not.toHaveBeenCalled();
    expect(db.intent.findMany).not.toHaveBeenCalled();
  });

  it('rejeita conta inativa apesar de token válido', async () => {
    db.user.findUnique.mockResolvedValue({ ...viewer, status: 'INACTIVE' });
    const response = await get('/v1/intents/feed?scope=following', 'Bearer synthetic-test-token');
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'ACCOUNT_INACTIVE' } });
    expect(db.intent.findMany).not.toHaveBeenCalled();
  });

  it('rejeita escopo desconhecido em vez de liberar outro feed', async () => {
    const response = await get('/v1/intents/feed?scope=private');
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(db.intent.findMany).not.toHaveBeenCalled();
  });
});

describe('acesso HTTP a Intent exclusiva', () => {
  beforeEach(() => {
    db.intent.findUnique.mockResolvedValue({
      id: intentId, creatorId, visibility: 'FOLLOWERS', status: 'PUBLISHED',
      creator: { id: creatorId, status: 'ACTIVE' },
      revealCiphertext: 'not-public', revealIv: 'not-public', revealAuthTag: 'not-public',
    });
  });

  it('não entrega detalhe exclusivo a visitante anônimo', async () => {
    const response = await get(`/v1/intents/${intentId}`);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'INTENT_FORBIDDEN' } });
  });

  it('não entrega detalhe exclusivo a usuário autenticado sem vínculo', async () => {
    const response = await get(`/v1/intents/${intentId}`, 'Bearer synthetic-test-token');
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'INTENT_FORBIDDEN' } });
  });

  it('entrega detalhe ao seguidor sem revelar conteúdo protegido', async () => {
    db.follow.findUnique.mockResolvedValue({ id: 'relation' });
    const response = await get(`/v1/intents/${intentId}`, 'Bearer synthetic-test-token');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({ id: intentId, visibility: 'FOLLOWERS', revealContent: null });
    for (const field of ['revealCiphertext', 'revealIv', 'revealAuthTag']) expect(body.data).not.toHaveProperty(field);
  });
});


describe('autoridade HTTP do backend', () => {
  const command = { title: 'Intent válida', story: 'Uma história válida', supportGoal: 3, revealContent: 'segredo' };
  function write(path: string, method: string, body: unknown, authenticated = true) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Bearer synthetic-test-token' } : {}) },
      body: JSON.stringify(body),
    });
  }

  it.each([
    { status: 'REALIZED' }, { realizedAt: new Date().toISOString() },
    { supportCount: 3 }, { creatorId }, { conditions: { satisfied: true } },
  ])('rejeita campos de autoridade na criação: %j', async (extra) => {
    const response = await write('/v1/intents', 'POST', { ...command, ...extra });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('exige autenticação para criar', async () => {
    expect((await write('/v1/intents', 'POST', command, false)).status).toBe(401);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('preserva o contrato de criação e atribui propriedade à identidade autenticada', async () => {
    db.$transaction.mockImplementation(async (operation) => operation(db));
    db.intent.create.mockResolvedValue({ id: intentId, status: 'PUBLISHED' });
    const response = await write('/v1/intents', 'POST', command);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { id: intentId, status: 'PUBLISHED' } });
    expect(db.intent.create.mock.calls[0]![0].data).toMatchObject({
      creatorId: viewer.id, status: 'PUBLISHED', supportCount: 0, realizedAt: null, supportGoal: 3,
    });
    expect(db.domainEvent.create.mock.calls[0]![0].data).toMatchObject({ actorId: viewer.id, type: 'INTENT_CREATED' });
  });

  it.each([
    ['PATCH', { supportGoal: 1 }], ['PUT', { supportGoal: 1 }],
    ['PATCH', { status: 'REALIZED' }], ['PUT', { status: 'REALIZED' }],
  ] as const)('não permite alterar condição ativa ou liberar manualmente via %s: %j, nem ao criador', async (method, change) => {
    db.user.findUnique.mockResolvedValue({ ...viewer, id: creatorId });
    db.user.update.mockResolvedValue({ ...viewer, id: creatorId });
    const response = await write(`/v1/intents/${intentId}`, method, change);
    expect(response.status).toBe(404);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('não oferece comando de liberação manual', async () => {
    expect((await write(`/v1/intents/${intentId}/release`, 'POST', {})).status).toBe(404);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
