import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Real app, routes, authentication middleware and feed services; no external I/O.
const { db, verifyIdToken } = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    intent: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
    domainEvent: { create: vi.fn() },
    follow: { findUnique: vi.fn(), count: vi.fn().mockResolvedValue(0), createManyAndReturn: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    support: { count: vi.fn(), findUnique: vi.fn() },
    notification: { count: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    intentComment: { count: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    intentReaction: { count: vi.fn(), groupBy: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn(), deleteMany: vi.fn() },
  },
  verifyIdToken: vi.fn(),
}));
vi.mock('../src/lib/prisma.js', () => ({ prisma: db }));
vi.mock('../src/lib/firebase.js', () => ({ firebaseAuth: { verifyIdToken } }));
vi.mock('../src/config.js', () => ({ config: {
  corsOrigins: ['http://localhost:3000'], logLevel: 'silent', revealEncryptionKey: Buffer.alloc(32, 7),
} }));

import { createApp } from '../src/app.js';

const viewer = {
  id: '10000000-0000-4000-8000-000000000002',
  firebaseUid: 'test-viewer',
  email: 'private@example.com',
  username: 'visitante',
  displayName: 'Visitante',
  bio: 'Perfil de teste',
  avatarUrl: null,
  status: 'ACTIVE',
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  updatedAt: new Date('2026-02-03T04:05:06.000Z'),
  passwordHash: 'never-return-this',
  tokens: ['never-return-this'],
};
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
  db.user.findMany.mockResolvedValue([]);
  db.user.update.mockResolvedValue(viewer);
  db.intent.findMany.mockResolvedValue([]);
  db.intent.count.mockResolvedValue(0);
  db.follow.findUnique.mockResolvedValue(null);
  db.follow.count.mockResolvedValue(0);
  db.support.count.mockResolvedValue(0);
  db.support.findUnique.mockResolvedValue(null);
  db.notification.findMany.mockResolvedValue([]);
  db.notification.count.mockResolvedValue(0);
  db.notification.createMany.mockResolvedValue({ count: 1 });
  db.notification.updateMany.mockResolvedValue({ count: 0 });
  db.notification.findFirst.mockResolvedValue(null);
  db.intentComment.count.mockResolvedValue(0);
  db.intentComment.findMany.mockResolvedValue([]);
  db.intentReaction.count.mockResolvedValue(0);
  db.intentReaction.groupBy.mockResolvedValue([]);
  db.intentReaction.findUnique.mockResolvedValue(null);
  db.$transaction.mockImplementation(async (operation) => operation(db));
});

function get(path: string, authorization?: string) {
  return fetch(`${baseUrl}${path}`, { headers: authorization ? { authorization } : {} });
}

describe('perfil público HTTP', () => {
  const path = `/v1/users/${creatorId}/profile`;
  it('exige autenticação sem consultar perfil público', async () => {
    expect((await get(path)).status).toBe(401);
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });

  it.each(['inexistente', 'suspenso'])('oculta usuário %s', async () => {
    db.user.findFirst.mockResolvedValue(null);
    const response = await get(path, 'Bearer synthetic-test-token');
    expect(response.status).toBe(404);
    expect(db.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: creatorId, status: 'ACTIVE' },
    }));
    expect(db.intent.findMany).not.toHaveBeenCalled();
  });

  it('retorna allowlist pública e estatísticas sem dados sensíveis', async () => {
    db.user.findFirst.mockResolvedValue({ ...viewer, id: creatorId });
    db.intent.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1).mockResolvedValue(0);
    db.support.count.mockResolvedValue(7);
    db.intentReaction.count.mockResolvedValue(4);
    db.intentComment.count.mockResolvedValue(2);
    const response = await get(path, 'Bearer synthetic-test-token');
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(Object.keys(data).sort()).toEqual(['id', 'username', 'displayName', 'bio', 'avatarUrl', 'createdAt', 'updatedAt', 'isMe', 'viewerIsFollowing', 'stats', 'intents'].sort());
    expect(data.stats).toEqual({
      intentsCreated: 3,
      intentsRealized: 1,
      totalSupportReceived: 7,
      totalReactionsReceived: 4,
      totalCommentsReceived: 2,
      publicIntentsCount: 3,
      followersCount: 0,
      followingCount: 0,
      supportedIntentsCount: 7,
      reactionsGivenCount: 4,
      commentsGivenCount: 2,
      realizedParticipationsCount: 0,
    });
    expect(data.intents).toEqual([]);
    expect(db.user.findFirst.mock.calls[0]![0].select).toEqual({
      id: true, username: true, displayName: true, bio: true,
      avatarUrl: true, createdAt: true, updatedAt: true,
    });
  });

  it('restringe lista e todos os agregados a Intents públicas, inclusive do próprio usuário', async () => {
    db.user.findFirst.mockResolvedValue(viewer);
    const publicIntent = { id: intentId, title: 'Acontecimento', story: 'História pública',
      status: 'PUBLISHED', createdAt: viewer.createdAt, supportCount: 2 };
    const records = [{ ...publicIntent, visibility: 'PUBLIC' },
      { ...publicIntent, id: 'private', visibility: 'PRIVATE' },
      { ...publicIntent, id: 'followers', visibility: 'FOLLOWERS' }];
    db.intent.findMany.mockImplementation(async ({ where }) => records
      .filter((record) => record.visibility === where.visibility)
      .map(({ visibility: _visibility, ...record }) => record));
    db.intent.count.mockResolvedValue(1);
    db.support.count.mockResolvedValue(2);
    db.intentReaction.count.mockResolvedValue(0);
    db.intentComment.count.mockResolvedValue(0);
    const response = await get(`/v1/users/${viewer.id}/profile`, 'Bearer synthetic-test-token');
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.intents).toEqual([{ ...publicIntent, createdAt: viewer.createdAt.toISOString() }]);
    const scope = { creatorId: viewer.id, visibility: 'PUBLIC',
      status: { in: ['PUBLISHED', 'REALIZED'] }, creator: { status: 'ACTIVE' } };
    expect(db.intent.findMany).toHaveBeenCalledWith({ where: scope, take: 20,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, title: true, story: true, status: true, createdAt: true, supportCount: true } });
    expect(db.intent.count).toHaveBeenCalledWith({ where: scope });
    expect(db.intent.count).toHaveBeenCalledWith({ where: { ...scope, status: 'REALIZED' } });
    expect(db.support.count).toHaveBeenCalledWith({ where: { intent: scope } });
    expect(db.intentReaction.count).toHaveBeenCalledWith({ where: { intent: scope } });
    expect(db.intentComment.count).toHaveBeenCalledWith({ where: { intent: scope, author: { status: 'ACTIVE' } } });
    expect(db.domainEvent.create).not.toHaveBeenCalled();
    expect(db.intent.create).not.toHaveBeenCalled();
  });
});

describe('rotas HTTP de seguir e deixar de seguir', () => {
  const followPath = `/v1/users/${creatorId}/follow`;

  it('exige autenticação para seguir', async () => {
    const response = await fetch(`${baseUrl}${followPath}`, { method: 'POST' });
    expect(response.status).toBe(401);
  });

  it('impede um usuário de seguir a si mesmo (409)', async () => {
    const selfFollowPath = `/v1/users/${viewer.id}/follow`;
    const response = await fetch(`${baseUrl}${selfFollowPath}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-test-token' },
    });
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error.code).toBe('SELF_FOLLOW_NOT_ALLOWED');
  });

  it('retorna 404 ao tentar seguir perfil inexistente ou inativo', async () => {
    db.user.findUnique.mockImplementation(async (args: any) => {
      if (args?.where?.firebaseUid) return viewer;
      return null;
    });
    const response = await fetch(`${baseUrl}${followPath}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-test-token' },
    });
    expect(response.status).toBe(404);
  });

  it('permite seguir com sucesso e retorna perfil atualizado com viewerIsFollowing', async () => {
    db.user.findUnique.mockResolvedValue({ id: creatorId, status: 'ACTIVE' });
    db.user.findFirst.mockResolvedValue({ ...viewer, id: creatorId });
    db.follow.createManyAndReturn.mockResolvedValue([{ id: 'relation-1' }]);
    db.follow.findUnique.mockResolvedValue({ id: 'relation-1' });

    const response = await fetch(`${baseUrl}${followPath}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-test-token' },
    });
    expect(response.status).toBe(201);
    const { data } = await response.json();
    expect(data).toHaveProperty('viewerIsFollowing', true);
    expect(data).toHaveProperty('stats');
    expect(data.stats).toHaveProperty('followersCount');
    expect(data.stats).toHaveProperty('followingCount');
  });

  it('seguir duas vezes é idempotente', async () => {
    db.user.findUnique.mockResolvedValue({ id: creatorId, status: 'ACTIVE' });
    db.user.findFirst.mockResolvedValue({ ...viewer, id: creatorId });
    db.follow.createManyAndReturn.mockResolvedValue([]);
    db.follow.findUnique.mockResolvedValue({ id: 'relation-1' });

    const response = await fetch(`${baseUrl}${followPath}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-test-token' },
    });
    expect(response.status).toBe(201);
  });

  it('permite deixar de seguir com sucesso (DELETE)', async () => {
    db.user.findFirst.mockResolvedValue({ ...viewer, id: creatorId });
    db.follow.deleteMany.mockResolvedValue({ count: 1 });
    db.follow.findUnique.mockResolvedValue(null);

    const response = await fetch(`${baseUrl}${followPath}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer synthetic-test-token' },
    });
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data).toHaveProperty('viewerIsFollowing', false);
  });
});

describe('regressão HTTP dos feeds e autenticação', () => {
  it.each(['/v1/intents/feed', '/v1/intents/feed?scope=public', '/v1/intents/feed?scope=all'])('Todos permite leitura anônima e mantém comportamento (%s)', async (path) => {
    const response = await get(path);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { items: [], nextCursor: null } });
    expect(db.intent.findMany.mock.calls[0]![0].where.visibility).toBe('PUBLIC');
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('Seguindo retorna Intents de usuários seguidos e respeita paginação', async () => {
    const mockIntent = {
      id: intentId,
      type: 'SUPPORT_REVEAL',
      conditionType: 'SUPPORT',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      category: 'TECHNOLOGY',
      title: 'Acontecimento de quem eu sigo',
      story: 'História do acontecimento',
      supportGoal: 10,
      supportCount: 3,
      revealAt: null,
      guardianApprovalGoal: null,
      publishedAt: new Date().toISOString(),
      realizedAt: null,
      createdAt: new Date().toISOString(),
      creator: {
        id: creatorId,
        username: 'criador',
        displayName: 'Criador Seguido',
        avatarUrl: null,
        status: 'ACTIVE',
      },
    };
    db.intent.findMany.mockResolvedValue([mockIntent, { ...mockIntent, id: '20000000-0000-4000-8000-000000000002' }]);

    const response = await get('/v1/intents/feed?scope=following&limit=1', 'Bearer synthetic-test-token');
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({
      id: intentId,
      title: 'Acontecimento de quem eu sigo',
      creator: { id: creatorId, username: 'criador', displayName: 'Criador Seguido' },
    });
    expect(data.items[0].creator).not.toHaveProperty('email');
    expect(data.items[0].creator).not.toHaveProperty('firebaseUid');
    expect(data.items[0]).not.toHaveProperty('revealCiphertext');
    expect(data.nextCursor).toBe(intentId);
    expect(db.intent.findMany.mock.calls[0]![0].orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
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

  it('Minhas Intents permite retornar privadas do próprio usuário sem filtro de feed', async () => {
    db.intent.findMany.mockResolvedValue([{
      id: intentId,
      creatorId: viewer.id,
      visibility: 'PRIVATE',
      status: 'PUBLISHED',
    }]);
    const response = await get('/v1/intents/mine', 'Bearer synthetic-test-token');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { items: [{ id: intentId, visibility: 'PRIVATE' }], nextCursor: null },
    });
    expect(db.intent.findMany.mock.calls[0]![0].where).toEqual({ creatorId: viewer.id });
  });

  it('lista Intents em que o usuário autenticado é guardião', async () => {
    db.intent.findMany.mockResolvedValue([{
      id: intentId,
      conditionType: 'GUARDIANS',
      visibility: 'PRIVATE',
      status: 'PUBLISHED',
      viewerIsGuardian: true,
    }]);
    const response = await get('/v1/intents/guardian-requests', 'Bearer synthetic-test-token');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { items: [{ id: intentId, conditionType: 'GUARDIANS', visibility: 'PRIVATE' }], nextCursor: null },
    });
    expect(db.intent.findMany.mock.calls[0]![0].where).toMatchObject({
      conditionType: 'GUARDIANS',
      creatorId: { not: viewer.id },
      creator: { status: 'ACTIVE' },
      guardianIds: { array_contains: [viewer.id] },
    });
  });
});

describe('busca HTTP autenticada', () => {
  it('exige autenticação', async () => {
    const response = await get('/v1/search?q=teste');
    expect(response.status).toBe(401);
    expect(db.intent.findMany).not.toHaveBeenCalled();
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it('retorna as duas coleções para o usuário autenticado', async () => {
    const response = await get('/v1/search?q=teste', 'Bearer synthetic-test-token');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { intents: [], users: [] } });
    expect(db.intent.findMany).toHaveBeenCalledOnce();
    expect(db.user.findMany).toHaveBeenCalledOnce();
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

describe('acesso HTTP a Intent privada', () => {
  beforeEach(() => {
    db.intent.findUnique.mockResolvedValue({
      id: intentId, creatorId, visibility: 'PRIVATE', status: 'PUBLISHED',
      creator: { id: creatorId, status: 'ACTIVE' },
      revealCiphertext: 'not-public', revealIv: 'not-public', revealAuthTag: 'not-public',
    });
  });

  it('não entrega detalhe privado a visitante anônimo', async () => {
    const response = await get(`/v1/intents/${intentId}`);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'INTENT_FORBIDDEN' } });
    expect(db.support.findUnique).not.toHaveBeenCalled();
  });

  it('não entrega detalhe privado a outro usuário autenticado', async () => {
    const response = await get(`/v1/intents/${intentId}`, 'Bearer synthetic-test-token');
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'INTENT_FORBIDDEN' } });
    expect(db.support.findUnique).not.toHaveBeenCalled();
  });

  it('entrega detalhe privado ao criador sem revelar conteúdo antes da meta', async () => {
    const creatorViewer = { ...viewer, id: creatorId };
    db.user.findUnique.mockResolvedValue(creatorViewer);
    db.user.update.mockResolvedValue(creatorViewer);
    const response = await get(`/v1/intents/${intentId}`, 'Bearer synthetic-test-token');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({ id: intentId, visibility: 'PRIVATE', revealContent: null });
    for (const field of ['revealCiphertext', 'revealIv', 'revealAuthTag']) expect(body.data).not.toHaveProperty(field);
  });
});

describe('busca HTTP de guardiões', () => {
  it('exige autenticação para buscar usuários', async () => {
    const response = await get('/v1/users/search?q=edi');
    expect(response.status).toBe(401);
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it('busca contas ativas por username ou nome e exclui o próprio usuário', async () => {
    db.user.findMany.mockResolvedValue([{ id: creatorId, username: 'edinho_grubert_1', displayName: 'Edinho Grubert', avatarUrl: null }]);
    const response = await get('/v1/users/search?q=@edinho', 'Bearer synthetic-test-token');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { items: [{ id: creatorId, username: 'edinho_grubert_1', displayName: 'Edinho Grubert', avatarUrl: null }] } });
    expect(db.user.findMany.mock.calls[0]![0]).toMatchObject({
      where: {
        id: { not: viewer.id },
        status: 'ACTIVE',
      },
      take: 10,
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });
    expect(db.user.findMany.mock.calls[0]![0].where.OR).toEqual([
      { username: { contains: 'edinho', mode: 'insensitive' } },
      { displayName: { contains: '@edinho', mode: 'insensitive' } },
    ]);
  });
});

describe('edição HTTP do próprio perfil', () => {
  const publicFields = ['id', 'username', 'displayName', 'bio', 'avatarUrl', 'createdAt', 'updatedAt'];

  function patchProfile(body: unknown, authenticated = true) {
    return fetch(`${baseUrl}/v1/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Bearer synthetic-test-token' } : {}) },
      body: JSON.stringify(body),
    });
  }

  it('exige autenticação', async () => {
    const response = await patchProfile({ displayName: 'Novo nome' }, false);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'AUTH_REQUIRED' } });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('rejeita payload vazio', async () => {
    const response = await patchProfile({});
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(db.user.update).toHaveBeenCalledTimes(1);
  });

  it.each(['username', 'email', 'status', 'passwordHash', 'firebaseUid', 'metrics', 'id', 'userId'])(
    'rejeita tentativa de alterar o campo protegido %s',
    async (field) => {
      const response = await patchProfile({ [field]: 'valor' });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(db.user.update).toHaveBeenCalledTimes(1);
    },
  );

  it('rejeita por inteiro payload misto com displayName e username', async () => {
    const response = await patchProfile({ displayName: 'Nome permitido', username: 'campo_proibido' });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(db.user.update).toHaveBeenCalledTimes(1);
  });

  it('altera apenas o próprio perfil, usa select explícito e retorna a allowlist exata', async () => {
    const updated = {
      ...viewer,
      displayName: 'Nome atualizado',
      bio: null,
      avatarUrl: 'https://example.com/avatar.png',
      updatedAt: new Date('2026-03-04T05:06:07.000Z'),
    };
    db.user.update.mockResolvedValueOnce(viewer).mockResolvedValueOnce(updated);

    const response = await patchProfile({
      displayName: updated.displayName,
      bio: null,
      avatarUrl: updated.avatarUrl,
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Object.keys(body.data)).toEqual(publicFields);
    expect(body.data).toEqual({
      id: viewer.id,
      username: viewer.username,
      displayName: updated.displayName,
      bio: null,
      avatarUrl: updated.avatarUrl,
      createdAt: viewer.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
    for (const field of ['passwordHash', 'firebaseUid', 'email', 'tokens', 'credentials', 'status']) {
      expect(body.data).not.toHaveProperty(field);
    }
    expect(db.user.update.mock.calls[1]![0]).toEqual({
      where: { id: viewer.id },
      data: { displayName: updated.displayName, bio: null, avatarUrl: updated.avatarUrl },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it.each([
    ['GET', '/v1/users/me'],
    ['POST', '/v1/users/me/sync'],
  ] as const)('%s %s usa a mesma projeção pública', async (method, path) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: 'Bearer synthetic-test-token' },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Object.keys(body.data)).toEqual(publicFields);
    for (const field of ['passwordHash', 'firebaseUid', 'email', 'tokens', 'credentials', 'status']) {
      expect(body.data).not.toHaveProperty(field);
    }
  });
});

describe('notificações HTTP autenticadas', () => {
  const notificationId = '30000000-0000-4000-8000-000000000001';
  const notification = {
    id: notificationId,
    type: 'SUPPORT_RECEIVED',
    readAt: null,
    createdAt: new Date('2026-09-13T12:00:00.000Z'),
    actor: {
      id: creatorId,
      username: 'criador',
      displayName: 'Criador',
      avatarUrl: null,
      email: 'secret@example.com',
      firebaseUid: 'secret-firebase-uid',
      passwordHash: 'secret-password-hash',
      tokens: ['secret-token'],
    },
    intent: { id: intentId, title: 'Intent do usuário', revealCiphertext: 'secret' },
  };

  it('exige autenticação para contar notificações não lidas', async () => {
    const response = await get('/v1/notifications/unread-count');
    expect(response.status).toBe(401);
    expect(db.notification.count).not.toHaveBeenCalled();
  });

  it('conta somente notificações não lidas do usuário autenticado e retorna o formato exato', async () => {
    db.notification.count.mockResolvedValue(12);
    const response = await get('/v1/notifications/unread-count', 'Bearer synthetic-test-token');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { unreadCount: 12 } });
    expect(db.notification.count).toHaveBeenCalledOnce();
    expect(db.notification.count).toHaveBeenCalledWith({
      where: { userId: viewer.id, readAt: null },
    });
  });

  it('rejeita userId externo sem consultar notificações de outro usuário', async () => {
    const response = await get(`/v1/notifications/unread-count?userId=${creatorId}`, 'Bearer synthetic-test-token');
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(db.notification.count).not.toHaveBeenCalled();
  });

  it('exige autenticação para listar', async () => {
    const response = await get('/v1/notifications');
    expect(response.status).toBe(401);
    expect(db.notification.findMany).not.toHaveBeenCalled();
  });

  it('lista somente pelo usuário autenticado, com select e sem dados sensíveis', async () => {
    db.notification.findMany.mockResolvedValue([notification]);
    db.intent.findMany.mockResolvedValue([{ id: intentId }]);
    const response = await get('/v1/notifications', 'Bearer synthetic-test-token');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.items).toEqual([{
      id: notificationId,
      type: 'SUPPORT_RECEIVED',
      readAt: null,
      createdAt: notification.createdAt.toISOString(),
      actor: { id: creatorId, username: 'criador', displayName: 'Criador', avatarUrl: null },
      intent: { id: intentId, title: 'Intent do usuário' },
    }]);
    expect(db.notification.findMany.mock.calls[0]![0]).toMatchObject({
      where: { userId: viewer.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true,
        type: true,
        readAt: true,
        createdAt: true,
        actor: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        intent: { select: { id: true, title: true } },
      },
    });
    for (const field of ['email', 'firebaseUid', 'passwordHash', 'tokens', 'status']) {
      expect(body.data.items[0].actor).not.toHaveProperty(field);
    }
    expect(body.data.items[0].intent).not.toHaveProperty('revealCiphertext');
  });

  it('marca como lida somente uma notificação própria', async () => {
    const readNotification = { ...notification, readAt: new Date('2026-09-13T12:05:00.000Z') };
    db.notification.updateMany.mockResolvedValue({ count: 1 });
    db.notification.findFirst.mockResolvedValue(readNotification);
    const response = await fetch(`${baseUrl}/v1/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer synthetic-test-token' },
    });
    expect(response.status).toBe(200);
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: { id: notificationId, userId: viewer.id, readAt: null },
      data: { readAt: expect.any(Date) },
    });
    expect(db.notification.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: notificationId, userId: viewer.id },
    }));
    expect((await response.json()).data.readAt).toBe(readNotification.readAt.toISOString());
  });

  it('não marca nem retorna notificação de outro usuário', async () => {
    const response = await fetch(`${baseUrl}/v1/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer synthetic-test-token' },
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: 'NOTIFICATION_NOT_FOUND' } });
    expect(db.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: notificationId, userId: viewer.id, readAt: null },
    }));
  });

  it('não aceita escolher outro usuário no corpo da marcação', async () => {
    const response = await fetch(`${baseUrl}/v1/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer synthetic-test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: creatorId }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(db.notification.updateMany).not.toHaveBeenCalled();
  });
});

describe('comentários HTTP em Intents', () => {
  const commentId = '40000000-0000-4000-8000-000000000001';
  const createdAt = new Date('2026-09-13T15:00:00.000Z');
  const comment = {
    id: commentId,
    body: 'Comentário público',
    createdAt,
    updatedAt: createdAt,
    author: {
      id: viewer.id,
      username: viewer.username,
      displayName: viewer.displayName,
      avatarUrl: null,
      email: 'never-return@example.com',
      firebaseUid: 'never-return-firebase',
      passwordHash: 'never-return-password',
      tokens: ['never-return-token'],
      status: 'ACTIVE',
    },
  };

  function intentAccess(overrides: Record<string, unknown> = {}) {
    return {
      id: intentId,
      creatorId,
      visibility: 'PUBLIC',
      status: 'PUBLISHED',
      guardianIds: [],
      creator: { status: 'ACTIVE' },
      revealCiphertext: 'never-return-ciphertext',
      revealIv: 'never-return-iv',
      revealAuthTag: 'never-return-tag',
      revealContent: 'never-return-content',
      ...overrides,
    };
  }

  function postComment(body: unknown, authenticated = true) {
    return fetch(`${baseUrl}/v1/intents/${intentId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Bearer synthetic-test-token' } : {}) },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    db.intent.findUnique.mockResolvedValue(intentAccess());
    db.intentComment.findMany.mockResolvedValue([comment]);
    db.intentComment.create.mockResolvedValue(comment);
  });

  it('GET exige autenticação', async () => {
    const response = await get(`/v1/intents/${intentId}/comments`);
    expect(response.status).toBe(401);
    expect(db.intentComment.findMany).not.toHaveBeenCalled();
  });

  it('POST exige autenticação', async () => {
    const response = await postComment({ body: 'Olá' }, false);
    expect(response.status).toBe(401);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('usuário inativo não lista nem cria comentários', async () => {
    db.user.findUnique.mockResolvedValue({ ...viewer, status: 'INACTIVE' });
    expect((await get(`/v1/intents/${intentId}/comments`, 'Bearer synthetic-test-token')).status).toBe(403);
    expect((await postComment({ body: 'Não autorizado' })).status).toBe(403);
    expect(db.intent.findUnique).not.toHaveBeenCalled();
    expect(db.intentComment.findMany).not.toHaveBeenCalled();
    expect(db.intentComment.create).not.toHaveBeenCalled();
  });

  it('usuário com acesso lista em ordem cronológica, com limite e projeção segura', async () => {
    const response = await get(`/v1/intents/${intentId}/comments`, 'Bearer synthetic-test-token');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ data: { items: [{
      id: commentId,
      body: comment.body,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      author: { id: viewer.id, username: viewer.username, displayName: viewer.displayName, avatarUrl: null },
    }] } });
    expect(db.intentComment.findMany).toHaveBeenCalledWith({
      where: { intentId, author: { status: 'ACTIVE' } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 50,
      select: {
        id: true,
        body: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });
    for (const field of ['email', 'firebaseUid', 'passwordHash', 'tokens', 'status']) {
      expect(body.data.items[0].author).not.toHaveProperty(field);
    }
    for (const secret of ['revealCiphertext', 'revealIv', 'revealAuthTag', 'revealContent']) {
      expect(JSON.stringify(body)).not.toContain(secret);
      expect(db.intent.findUnique.mock.calls[0]![0].select).not.toHaveProperty(secret);
    }
  });

  it('usuário sem acesso não lista nem consulta comentários', async () => {
    db.intent.findUnique.mockResolvedValue(intentAccess({ visibility: 'PRIVATE' }));
    const response = await get(`/v1/intents/${intentId}/comments`, 'Bearer synthetic-test-token');
    expect(response.status).toBe(403);
    expect(db.intentComment.findMany).not.toHaveBeenCalled();
  });

  it('usuário com acesso cria comentário como o usuário autenticado e aplica trim', async () => {
    const response = await postComment({ body: '  Comentário público  ' });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: {
      id: commentId,
      body: comment.body,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      author: { id: viewer.id, username: viewer.username, displayName: viewer.displayName, avatarUrl: null },
    } });
    expect(db.intentComment.create.mock.calls[0]![0]).toMatchObject({
      data: { intentId, authorId: viewer.id, body: 'Comentário público' },
    });
  });

  it('usuário sem acesso não cria comentário', async () => {
    db.intent.findUnique.mockResolvedValue(intentAccess({ visibility: 'PRIVATE' }));
    const response = await postComment({ body: 'Bloqueado' });
    expect(response.status).toBe(403);
    expect(db.intentComment.create).not.toHaveBeenCalled();
  });

  it('PRIVATE permite comentários do próprio criador', async () => {
    const creatorViewer = { ...viewer, id: creatorId };
    db.user.findUnique.mockResolvedValue(creatorViewer);
    db.user.update.mockResolvedValue(creatorViewer);
    db.intent.findUnique.mockResolvedValue(intentAccess({ visibility: 'PRIVATE' }));
    expect((await get(`/v1/intents/${intentId}/comments`, 'Bearer synthetic-test-token')).status).toBe(200);
  });

  it('PRIVATE com guardião autorizado permite listar e criar', async () => {
    db.intent.findUnique.mockResolvedValue(intentAccess({ visibility: 'PRIVATE', guardianIds: [viewer.id], conditionType: 'GUARDIANS' }));
    expect((await get(`/v1/intents/${intentId}/comments`, 'Bearer synthetic-test-token')).status).toBe(200);
    expect((await postComment({ body: 'Acesso de guardião' })).status).toBe(201);
  });

  it('FOLLOWERS bloqueia quem não segue', async () => {
    db.intent.findUnique.mockResolvedValue(intentAccess({ visibility: 'FOLLOWERS' }));
    expect((await get(`/v1/intents/${intentId}/comments`, 'Bearer synthetic-test-token')).status).toBe(403);
    expect((await postComment({ body: 'Sem vínculo' })).status).toBe(403);
    expect(db.intentComment.findMany).not.toHaveBeenCalled();
    expect(db.intentComment.create).not.toHaveBeenCalled();
  });

  it('FOLLOWERS permite quem segue o criador', async () => {
    db.intent.findUnique.mockResolvedValue(intentAccess({ visibility: 'FOLLOWERS' }));
    db.follow.findUnique.mockResolvedValue({ id: 'follow-relation' });
    expect((await get(`/v1/intents/${intentId}/comments`, 'Bearer synthetic-test-token')).status).toBe(200);
    expect((await postComment({ body: 'Sou seguidor' })).status).toBe(201);
  });

  it.each([
    [{ body: '' }, 'vazio'],
    [{ body: '   ' }, 'sem caractere útil'],
    [{ body: 'x'.repeat(501) }, 'acima de 500'],
    [{ body: 'válido', authorId: creatorId }, 'com authorId'],
    [{ body: 'válido', intentId }, 'com intentId'],
    [{ body: 'válido', extra: true }, 'com campo extra'],
  ])('rejeita body %s (%s)', async (payload, _description) => {
    const response = await postComment(payload);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(db.$transaction).not.toHaveBeenCalled();
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

  it('aceita criar Intent privada e persiste a visibilidade no backend', async () => {
    db.$transaction.mockImplementation(async (operation) => operation(db));
    db.intent.create.mockResolvedValue({ id: intentId, status: 'PUBLISHED', visibility: 'PRIVATE', conditionType: 'DATE' });
    const revealAt = new Date(Date.now() + 60_000).toISOString();
    const response = await write('/v1/intents', 'POST', { ...command, visibility: 'PRIVATE', conditionType: 'DATE', revealAt });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { id: intentId, status: 'PUBLISHED', visibility: 'PRIVATE', conditionType: 'DATE' } });
    expect(db.intent.create.mock.calls[0]![0].data).toMatchObject({
      creatorId: viewer.id,
      status: 'PUBLISHED',
      visibility: 'PRIVATE',
      conditionType: 'DATE',
      supportCount: 0,
      realizedAt: null,
    });
  });

  it('rejeita Intent privada baseada em apoios para evitar regra impossível', async () => {
    const response = await write('/v1/intents', 'POST', { ...command, visibility: 'PRIVATE', conditionType: 'SUPPORT' });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(db.$transaction).not.toHaveBeenCalled();
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
