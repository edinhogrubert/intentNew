import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { db, verifyIdToken } = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    intent: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
    domainEvent: { create: vi.fn() },
    follow: { findUnique: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    support: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    notification: { count: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    intentComment: { count: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    intentReaction: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn().mockResolvedValue([]) },
  },
  verifyIdToken: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({ prisma: db, isTransientDbError: () => false }));
vi.mock('../src/lib/firebase.js', () => ({ firebaseAuth: { verifyIdToken } }));
vi.mock('../src/config.js', () => ({
  config: {
    corsOrigins: ['http://localhost:3000'],
    logLevel: 'silent',
    revealEncryptionKey: Buffer.alloc(32, 7),
  },
}));

import { createApp } from '../src/app.js';
import { encodeActivityCursor, decodeActivityCursor } from '../src/services/public-activity-service.js';

const viewer = {
  id: '10000000-0000-4000-8000-000000000002',
  firebaseUid: 'test-viewer',
  email: 'viewer@example.com',
  username: 'visitante',
  displayName: 'Visitante',
  bio: 'Perfil visitante',
  avatarUrl: null,
  status: 'ACTIVE',
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  updatedAt: new Date('2026-02-03T04:05:06.000Z'),
  passwordHash: 'never-return-this',
  tokens: ['never-return-this'],
};

const targetUser = {
  id: '10000000-0000-4000-8000-000000000001',
  firebaseUid: 'test-target',
  email: 'target@example.com',
  username: 'joao.silva',
  displayName: 'João Silva',
  bio: 'Bio do João',
  avatarUrl: null,
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

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
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  verifyIdToken.mockResolvedValue({ uid: viewer.firebaseUid, email: viewer.email });
  db.user.findUnique.mockImplementation(async ({ where }: { where: { firebaseUid?: string; id?: string } }) => {
    if (where.firebaseUid === viewer.firebaseUid || where.id === viewer.id) return viewer;
    if (where.id === targetUser.id) return targetUser;
    return null;
  });
  db.user.findFirst.mockImplementation(async ({ where }: { where: { id?: string; status?: string } }) => {
    if (where.id === targetUser.id && where.status === 'ACTIVE') return targetUser;
    if (where.id === viewer.id && where.status === 'ACTIVE') return viewer;
    return null;
  });
  db.user.update.mockImplementation(async ({ where, data }: any) => {
    if (where.id === viewer.id) return { ...viewer, ...data };
    if (where.id === targetUser.id) return { ...targetUser, ...data };
    return { ...viewer, ...data };
  });
});

describe('Bloco 24 — Atividade Pública do Perfil', () => {
  it('encodes and decodes activity cursor reliably', () => {
    const date = new Date('2026-03-15T14:30:00.000Z');
    const id = 'intent_created:123-abc';
    const cursor = encodeActivityCursor(date, id);
    expect(typeof cursor).toBe('string');

    const decoded = decodeActivityCursor(cursor);
    expect(decoded).not.toBeNull();
    expect(decoded?.occurredAt.toISOString()).toBe(date.toISOString());
    expect(decoded?.id).toBe(id);
  });

  it('returns 404 if target user is not active or does not exist', async () => {
    db.user.findFirst.mockResolvedValueOnce(null);

    const response = await fetch(`${baseUrl}/v1/users/00000000-0000-4000-8000-000000000099/activity`, {
      headers: { Authorization: 'Bearer valid-token' },
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error?.code).toBe('USER_NOT_FOUND');
  });

  it('aggregates created intents, supports, reactions, and comments chronologically', async () => {
    const creatorUser = {
      id: targetUser.id,
      username: targetUser.username,
      displayName: targetUser.displayName,
      avatarUrl: null,
    };

    // 1. Intent criada
    db.intent.findMany.mockResolvedValueOnce([
      {
        id: 'intent-101',
        title: 'Criar uma horta comunitária',
        status: 'PUBLISHED',
        category: 'COMMUNITY_CAUSES',
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
        publishedAt: new Date('2026-03-10T10:00:00.000Z'),
        realizedAt: null,
        supportGoal: 50,
        supportCount: 12,
        creator: creatorUser,
      },
    ]);

    // 2. Apoio a uma intent realizada (Participação em realização)
    db.support.findMany.mockResolvedValueOnce([
      {
        id: 'support-201',
        createdAt: new Date('2026-03-12T15:00:00.000Z'),
        intent: {
          id: 'intent-realized-999',
          title: 'Maratona Solidária 2026',
          status: 'REALIZED',
          category: 'SPORTS',
          realizedAt: new Date('2026-03-14T18:00:00.000Z'),
          supportGoal: 100,
          supportCount: 105,
          creator: {
            id: 'creator-999',
            username: 'maria.atleta',
            displayName: 'Maria Atleta',
            avatarUrl: null,
          },
        },
      },
    ]);

    // 3. Reação dada
    db.intentReaction.findMany.mockResolvedValueOnce([
      {
        id: 'reaction-301',
        type: 'CELEBRATE',
        createdAt: new Date('2026-03-15T09:00:00.000Z'),
        intent: {
          id: 'intent-realized-999',
          title: 'Maratona Solidária 2026',
          status: 'REALIZED',
          category: 'SPORTS',
          realizedAt: new Date('2026-03-14T18:00:00.000Z'),
          creator: {
            id: 'creator-999',
            username: 'maria.atleta',
            displayName: 'Maria Atleta',
            avatarUrl: null,
          },
        },
      },
    ]);

    // 4. Comentário feito
    db.intentComment.findMany.mockResolvedValueOnce([
      {
        id: 'comment-401',
        body: 'Parabéns pela conquista incrível de todos os envolvidos!',
        createdAt: new Date('2026-03-13T12:00:00.000Z'),
        intent: {
          id: 'intent-realized-999',
          title: 'Maratona Solidária 2026',
          status: 'REALIZED',
          category: 'SPORTS',
          realizedAt: new Date('2026-03-14T18:00:00.000Z'),
          creator: {
            id: 'creator-999',
            username: 'maria.atleta',
            displayName: 'Maria Atleta',
            avatarUrl: null,
          },
        },
      },
    ]);

    const response = await fetch(`${baseUrl}/v1/users/${targetUser.id}/activity`, {
      headers: { Authorization: 'Bearer valid-token' },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    const items = body.data.items;

    expect(items).toHaveLength(4);

    // Ordem esperada: 15/03 (Reação) -> 13/03 (Comentário) -> 12/03 (Apoio) -> 10/03 (Criação)
    expect(items[0].type).toBe('INTENT_REACTED');
    expect(items[0].metadata?.reactionType).toBe('CELEBRATE');

    expect(items[1].type).toBe('INTENT_COMMENTED');
    expect(items[1].metadata?.commentSnippet).toBe('Parabéns pela conquista incrível de todos os envolvidos!');

    expect(items[2].type).toBe('INTENT_REALIZED_PARTICIPATION');
    expect(items[2].intent.status).toBe('REALIZED');
    expect(items[2].metadata?.realizedAt).toBe('2026-03-14T18:00:00.000Z');

    expect(items[3].type).toBe('INTENT_CREATED');
    expect(items[3].intent.title).toBe('Criar uma horta comunitária');

    // Garantir que nenhum dado sensível foi vazado
    for (const item of items) {
      expect((item as any).revealCiphertext).toBeUndefined();
      expect((item as any).revealIv).toBeUndefined();
      expect((item as any).guardianIds).toBeUndefined();
      expect(item.intent.creator?.email).toBeUndefined();
    }
  });

  it('respects limit and generates valid nextCursor for pagination', async () => {
    const creatorUser = {
      id: targetUser.id,
      username: targetUser.username,
      displayName: targetUser.displayName,
      avatarUrl: null,
    };

    db.intent.findMany.mockResolvedValueOnce([
      {
        id: 'intent-page-1',
        title: 'Intent 1',
        status: 'PUBLISHED',
        category: 'EDUCATION',
        createdAt: new Date('2026-03-20T10:00:00.000Z'),
        publishedAt: new Date('2026-03-20T10:00:00.000Z'),
        realizedAt: null,
        supportGoal: 10,
        supportCount: 2,
        creator: creatorUser,
      },
      {
        id: 'intent-page-2',
        title: 'Intent 2',
        status: 'PUBLISHED',
        category: 'EDUCATION',
        createdAt: new Date('2026-03-19T10:00:00.000Z'),
        publishedAt: new Date('2026-03-19T10:00:00.000Z'),
        realizedAt: null,
        supportGoal: 10,
        supportCount: 2,
        creator: creatorUser,
      },
      {
        id: 'intent-page-3',
        title: 'Intent 3',
        status: 'PUBLISHED',
        category: 'EDUCATION',
        createdAt: new Date('2026-03-18T10:00:00.000Z'),
        publishedAt: new Date('2026-03-18T10:00:00.000Z'),
        realizedAt: null,
        supportGoal: 10,
        supportCount: 2,
        creator: creatorUser,
      },
    ]);
    db.support.findMany.mockResolvedValueOnce([]);
    db.intentReaction.findMany.mockResolvedValueOnce([]);
    db.intentComment.findMany.mockResolvedValueOnce([]);

    const response = await fetch(`${baseUrl}/v1/users/${targetUser.id}/activity?limit=2`, {
      headers: { Authorization: 'Bearer valid-token' },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.items).toHaveLength(2);
    expect(body.data.nextCursor).toBeTruthy();

    const decoded = decodeActivityCursor(body.data.nextCursor);
    expect(decoded?.id).toBe('intent_created:intent-page-2');
  });

  describe('Bloco 25C — Filtros da Atividade Pública', () => {
    const creatorUser = {
      id: targetUser.id,
      username: targetUser.username,
      displayName: targetUser.displayName,
      avatarUrl: null,
    };

    it('filters activity by INTENT_CREATED correctly', async () => {
      db.intent.findMany.mockResolvedValueOnce([
        {
          id: 'intent-c1',
          title: 'Intent Criada 1',
          status: 'PUBLISHED',
          category: 'COMMUNITY',
          createdAt: new Date('2026-03-22T10:00:00.000Z'),
          publishedAt: new Date('2026-03-22T10:00:00.000Z'),
          realizedAt: null,
          supportGoal: 5,
          supportCount: 1,
          creator: creatorUser,
        },
      ]);

      const response = await fetch(`${baseUrl}/v1/users/${targetUser.id}/activity?type=INTENT_CREATED`, {
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].type).toBe('INTENT_CREATED');
      expect(body.data.items[0].intent.title).toBe('Intent Criada 1');
      // When filtering INTENT_CREATED, other tables must not be queried
      expect(db.support.findMany).not.toHaveBeenCalled();
      expect(db.intentReaction.findMany).not.toHaveBeenCalled();
      expect(db.intentComment.findMany).not.toHaveBeenCalled();
    });

    it('filters activity by INTENT_SUPPORTED and INTENT_REALIZED_PARTICIPATION correctly', async () => {
      db.support.findMany.mockResolvedValueOnce([
        {
          id: 'support-1',
          createdAt: new Date('2026-03-21T10:00:00.000Z'),
          intent: {
            id: 'intent-s1',
            title: 'Intent Apoiada',
            status: 'PUBLISHED',
            category: 'TECH',
            realizedAt: null,
            supportGoal: 10,
            supportCount: 4,
            creator: creatorUser,
          },
        },
      ]);

      const response = await fetch(`${baseUrl}/v1/users/${targetUser.id}/activity?type=INTENT_SUPPORTED`, {
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].type).toBe('INTENT_SUPPORTED');
      expect(db.intent.findMany).not.toHaveBeenCalled();
    });

    it('filters activity by INTENT_REALIZED_PARTICIPATION correctly', async () => {
      db.support.findMany.mockResolvedValueOnce([
        {
          id: 'support-realized',
          createdAt: new Date('2026-03-20T10:00:00.000Z'),
          intent: {
            id: 'intent-r1',
            title: 'Intent Realizada com Sucesso',
            status: 'REALIZED',
            category: 'CULTURE',
            realizedAt: new Date('2026-03-20T12:00:00.000Z'),
            supportGoal: 20,
            supportCount: 20,
            creator: creatorUser,
          },
        },
      ]);

      const response = await fetch(`${baseUrl}/v1/users/${targetUser.id}/activity?type=INTENT_REALIZED_PARTICIPATION`, {
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].type).toBe('INTENT_REALIZED_PARTICIPATION');
      expect(body.data.items[0].metadata.realizedAt).toBe('2026-03-20T12:00:00.000Z');
    });

    it('filters activity by INTENT_REACTED correctly', async () => {
      db.intentReaction.findMany.mockResolvedValueOnce([
        {
          id: 'reaction-1',
          type: 'LOVE',
          createdAt: new Date('2026-03-19T10:00:00.000Z'),
          intent: {
            id: 'intent-re1',
            title: 'Intent com Reação',
            status: 'PUBLISHED',
            category: 'COMMUNITY',
            realizedAt: null,
            creator: creatorUser,
          },
        },
      ]);

      const response = await fetch(`${baseUrl}/v1/users/${targetUser.id}/activity?type=INTENT_REACTED`, {
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].type).toBe('INTENT_REACTED');
      expect(body.data.items[0].metadata.reactionType).toBe('LOVE');
    });

    it('filters activity by INTENT_COMMENTED correctly', async () => {
      db.intentComment.findMany.mockResolvedValueOnce([
        {
          id: 'comment-1',
          body: 'Comentário público muito inspirador!',
          createdAt: new Date('2026-03-18T10:00:00.000Z'),
          intent: {
            id: 'intent-c1',
            title: 'Intent com Comentário',
            status: 'PUBLISHED',
            category: 'HEALTH',
            realizedAt: null,
            creator: creatorUser,
          },
        },
      ]);

      const response = await fetch(`${baseUrl}/v1/users/${targetUser.id}/activity?type=INTENT_COMMENTED`, {
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].type).toBe('INTENT_COMMENTED');
      expect(body.data.items[0].metadata.commentSnippet).toBe('Comentário público muito inspirador!');
    });

    it('returns empty list for filter with no matching events', async () => {
      db.intent.findMany.mockResolvedValueOnce([]);

      const response = await fetch(`${baseUrl}/v1/users/${targetUser.id}/activity?type=INTENT_CREATED`, {
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.items).toHaveLength(0);
      expect(body.data.nextCursor).toBeNull();
    });

    it('paginates correctly within a filtered activity stream using cursor', async () => {
      db.intent.findMany.mockResolvedValueOnce([
        {
          id: 'intent-f-1',
          title: 'Intent F1',
          status: 'PUBLISHED',
          category: 'COMMUNITY',
          createdAt: new Date('2026-03-25T10:00:00.000Z'),
          publishedAt: new Date('2026-03-25T10:00:00.000Z'),
          realizedAt: null,
          supportGoal: 10,
          supportCount: 2,
          creator: creatorUser,
        },
        {
          id: 'intent-f-2',
          title: 'Intent F2',
          status: 'PUBLISHED',
          category: 'COMMUNITY',
          createdAt: new Date('2026-03-24T10:00:00.000Z'),
          publishedAt: new Date('2026-03-24T10:00:00.000Z'),
          realizedAt: null,
          supportGoal: 10,
          supportCount: 2,
          creator: creatorUser,
        },
      ]);

      const response = await fetch(`${baseUrl}/v1/users/${targetUser.id}/activity?type=INTENT_CREATED&limit=1`, {
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].id).toBe('intent_created:intent-f-1');
      expect(body.data.nextCursor).toBeTruthy();

      const decoded = decodeActivityCursor(body.data.nextCursor);
      expect(decoded?.id).toBe('intent_created:intent-f-1');
    });

    it('rejects invalid activity filter with 400', async () => {
      const response = await fetch(`${baseUrl}/v1/users/${targetUser.id}/activity?type=INVALID_FILTER`, {
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(response.status).toBe(400);
    });
  });
});
