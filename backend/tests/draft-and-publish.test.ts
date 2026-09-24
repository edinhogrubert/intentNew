import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { db, verifyIdToken } = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    intent: { findMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    domainEvent: { create: vi.fn() },
    idempotencyRequest: { findUnique: vi.fn(), create: vi.fn() },
    support: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    intentReaction: { groupBy: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    intentComment: { findMany: vi.fn(), create: vi.fn() },
    intentWatch: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    notification: { count: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    follow: { findUnique: vi.fn() },
    $transaction: vi.fn(),
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

const creator = {
  id: '10000000-0000-4000-8000-000000000001',
  firebaseUid: 'firebase-creator',
  email: 'creator@example.com',
  username: 'autor',
  displayName: 'Autor da Intent',
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const otherUser = {
  id: '10000000-0000-4000-8000-000000000002',
  firebaseUid: 'firebase-other',
  email: 'other@example.com',
  username: 'outro',
  displayName: 'Outro Usuário',
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const draftIntentId = '20000000-0000-4000-8000-000000000001';

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
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  verifyIdToken.mockImplementation(async (token: string) => {
    if (token === 'token-creator') return { uid: creator.firebaseUid };
    if (token === 'token-other') return { uid: otherUser.firebaseUid };
    throw new Error('Token inválido');
  });
  db.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; firebaseUid?: string } }) => {
    if (where.firebaseUid === creator.firebaseUid || where.id === creator.id) return creator;
    if (where.firebaseUid === otherUser.firebaseUid || where.id === otherUser.id) return otherUser;
    return null;
  });
  db.user.update.mockImplementation(async ({ where, data }: any) => {
    if (where.id === creator.id) return { ...creator, ...data };
    if (where.id === otherUser.id) return { ...otherUser, ...data };
    return { ...creator, ...data };
  });
  db.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(db));
  db.intentReaction.groupBy.mockResolvedValue([]);
  db.intentReaction.findUnique.mockResolvedValue(null);
  db.intentWatch.findUnique.mockResolvedValue(null);
  db.support.findUnique.mockResolvedValue(null);
  db.idempotencyRequest.findUnique.mockResolvedValue(null);
  db.idempotencyRequest.create.mockResolvedValue({ id: 'req-1' });
});

describe('Bloco 37C-1: DRAFT e Publicação Explícita de Intents', () => {
  describe('Criação de Intent', () => {
    it('cria Intent como PUBLISHED por padrão (fluxo direto de 1 clique)', async () => {
      db.intent.create.mockImplementation(async ({ data }: any) => ({
        id: data.id,
        creatorId: data.creatorId,
        type: data.type,
        conditionType: data.conditionType,
        status: data.status,
        supportGoal: data.supportGoal,
        supportCount: 0,
        publishedAt: data.publishedAt,
        realizedAt: null,
        createdAt: new Date(),
        title: data.title,
        story: data.story,
        category: data.category,
        visibility: data.visibility,
        creator: { id: creator.id, username: creator.username, displayName: creator.displayName, avatarUrl: null },
      }));

      const res = await fetch(`${baseUrl}/v1/intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-creator',
        },
        body: JSON.stringify({
          title: 'Intent Direta',
          story: 'História da Intent criada direto',
          revealContent: 'Segredo Revelado',
          conditionType: 'SUPPORT',
          supportGoal: 10,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.status).toBe('PUBLISHED');
      expect(json.data.publishedAt).toBeDefined();

      // Verifica dados passados para o Prisma
      const createCall = db.intent.create.mock.calls[0][0];
      expect(createCall.data.status).toBe('PUBLISHED');
      expect(createCall.data.publishedAt).toBeInstanceOf(Date);

      // Verifica evento de domínio INTENT_CREATED emitido com status PUBLISHED
      const eventCall = db.domainEvent.create.mock.calls[0][0];
      expect(eventCall.data.type).toBe('INTENT_CREATED');
      expect(eventCall.data.payload.status).toBe('PUBLISHED');
      expect(eventCall.data.payload.publishedAt).toBeDefined();
    });

    it('cria Intent como DRAFT quando solicitado (Salvar como rascunho)', async () => {
      db.intent.create.mockImplementation(async ({ data }: any) => ({
        id: data.id,
        creatorId: data.creatorId,
        type: data.type,
        conditionType: data.conditionType,
        status: data.status,
        supportGoal: data.supportGoal,
        supportCount: 0,
        publishedAt: data.publishedAt,
        realizedAt: null,
        createdAt: new Date(),
        title: data.title,
        story: data.story,
        category: data.category,
        visibility: data.visibility,
        creator: { id: creator.id, username: creator.username, displayName: creator.displayName, avatarUrl: null },
      }));

      const res = await fetch(`${baseUrl}/v1/intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-creator',
        },
        body: JSON.stringify({
          title: 'Intent Rascunho',
          story: 'Preparando com calma antes de publicar',
          revealContent: 'Segredo em rascunho',
          conditionType: 'SUPPORT',
          supportGoal: 50,
          status: 'DRAFT',
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.status).toBe('DRAFT');
      expect(json.data.publishedAt).toBeNull();

      // Verifica que no banco publishedAt foi null
      const createCall = db.intent.create.mock.calls[0][0];
      expect(createCall.data.status).toBe('DRAFT');
      expect(createCall.data.publishedAt).toBeNull();

      // Verifica evento INTENT_CREATED gravando status DRAFT e publishedAt null
      const eventCall = db.domainEvent.create.mock.calls[0][0];
      expect(eventCall.data.type).toBe('INTENT_CREATED');
      expect(eventCall.data.payload.status).toBe('DRAFT');
      expect(eventCall.data.payload.publishedAt).toBeNull();
    });
  });

  describe('Isolamento e Invisibilidade de DRAFT', () => {
    const mockDraftIntent = {
      id: draftIntentId,
      creatorId: creator.id,
      type: 'SUPPORT_REVEAL',
      conditionType: 'SUPPORT',
      status: 'DRAFT',
      visibility: 'PUBLIC',
      category: 'OTHER',
      title: 'Rascunho Secreto',
      story: 'História em elaboração',
      supportGoal: 10,
      supportCount: 0,
      publishedAt: null,
      realizedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      revealCiphertext: 'dummy',
      revealIv: 'dummy',
      revealAuthTag: 'dummy',
      revealVersion: 1,
      guardianIds: [],
      guardianApprovals: [],
      guardianApprovalGoal: null,
      creator: { id: creator.id, username: 'autor', displayName: 'Autor', avatarUrl: null, status: 'ACTIVE' },
    };

    it('autor criador consegue visualizar seu próprio rascunho', async () => {
      db.intent.findUnique.mockResolvedValue(mockDraftIntent);

      const res = await fetch(`${baseUrl}/v1/intents/${draftIntentId}`, {
        headers: { Authorization: 'Bearer token-creator' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.id).toBe(draftIntentId);
      expect(json.data.status).toBe('DRAFT');
    });

    it('outro usuário recebe 404 (ocultação total) ao tentar visualizar rascunho alheio', async () => {
      db.intent.findUnique.mockResolvedValue(mockDraftIntent);

      const res = await fetch(`${baseUrl}/v1/intents/${draftIntentId}`, {
        headers: { Authorization: 'Bearer token-other' },
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe('INTENT_NOT_FOUND');
    });

    it('usuário anônimo recebe 404 ao tentar visualizar rascunho', async () => {
      db.intent.findUnique.mockResolvedValue(mockDraftIntent);

      const res = await fetch(`${baseUrl}/v1/intents/${draftIntentId}`);
      expect(res.status).toBe(404);
    });

    it('bloqueia comentários em Intent em rascunho', async () => {
      db.intent.findUnique.mockResolvedValue(mockDraftIntent);

      const res = await fetch(`${baseUrl}/v1/intents/${draftIntentId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-creator',
        },
        body: JSON.stringify({ body: 'Tentativa de comentário em rascunho' }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('INTENT_NOT_PUBLISHED');
      expect(db.intentComment.create).not.toHaveBeenCalled();
    });

    it('bloqueia reações em Intent em rascunho', async () => {
      db.intent.findUnique.mockResolvedValue(mockDraftIntent);

      const res = await fetch(`${baseUrl}/v1/intents/${draftIntentId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-creator',
        },
        body: JSON.stringify({ type: 'LIKE' }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('INTENT_NOT_PUBLISHED');
      expect(db.intentReaction.upsert).not.toHaveBeenCalled();
    });

    it('bloqueia acompanhamento (watch) em Intent em rascunho', async () => {
      db.intent.findUnique.mockResolvedValue(mockDraftIntent);

      const res = await fetch(`${baseUrl}/v1/intents/${draftIntentId}/watch`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token-creator',
        },
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('INTENT_NOT_PUBLISHED');
      expect(db.intentWatch.upsert).not.toHaveBeenCalled();
    });

    it('bloqueia apoio a Intent em rascunho', async () => {
      db.intent.findUnique.mockResolvedValue(mockDraftIntent);

      const res = await fetch(`${baseUrl}/v1/intents/${draftIntentId}/supports`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token-other' },
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.code).toBe('INTENT_NOT_OPEN');
      expect(db.support.create).not.toHaveBeenCalled();
    });
  });

  describe('Publicação Explícita (POST /v1/intents/:id/publish)', () => {
    const mockDraft = {
      id: draftIntentId,
      creatorId: creator.id,
      type: 'SUPPORT_REVEAL',
      conditionType: 'SUPPORT',
      status: 'DRAFT',
      visibility: 'PUBLIC',
      category: 'OTHER',
      title: 'Meu Rascunho',
      story: 'História pronta',
      supportGoal: 10,
      supportCount: 0,
      publishedAt: null,
      realizedAt: null,
      createdAt: new Date('2026-03-01T10:00:00Z'),
      updatedAt: new Date('2026-03-01T10:00:00Z'),
      creator: { id: creator.id, status: 'ACTIVE' },
    };

    it('exige autenticação para publicar', async () => {
      const res = await fetch(`${baseUrl}/v1/intents/${draftIntentId}/publish`, {
        method: 'POST',
      });
      expect(res.status).toBe(401);
    });

    it('rejeita se o usuário não for o criador da Intent', async () => {
      db.intent.findUnique.mockResolvedValue(mockDraft);

      const res = await fetch(`${baseUrl}/v1/intents/${draftIntentId}/publish`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token-other' },
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('INTENT_FORBIDDEN');
      expect(db.intent.update).not.toHaveBeenCalled();
    });

    it('publica o rascunho com sucesso, atribuindo publishedAt e emitindo INTENT_PUBLISHED', async () => {
      db.intent.findUnique.mockResolvedValue(mockDraft);
      const publishedDate = new Date();
      db.intent.update.mockResolvedValue({
        ...mockDraft,
        status: 'PUBLISHED',
        publishedAt: publishedDate,
        creator: { id: creator.id, username: 'autor', displayName: 'Autor', avatarUrl: null },
      });

      const res = await fetch(`${baseUrl}/v1/intents/${draftIntentId}/publish`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token-creator' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe('PUBLISHED');
      expect(json.data.publishedAt).toBeDefined();

      // Verifica update no Prisma
      expect(db.intent.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: draftIntentId },
        data: expect.objectContaining({
          status: 'PUBLISHED',
          publishedAt: expect.any(Date),
        }),
      }));

      // Verifica evento de domínio INTENT_PUBLISHED emitido
      expect(db.domainEvent.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          intentId: draftIntentId,
          actorId: creator.id,
          type: 'INTENT_PUBLISHED',
          payload: expect.objectContaining({
            previousStatus: 'DRAFT',
            newStatus: 'PUBLISHED',
            visibility: 'PUBLIC',
          }),
        }),
      }));
    });

    it('é idempotente: publicar uma Intent já publicada retorna sucesso sem duplicar evento', async () => {
      const alreadyPublished = {
        ...mockDraft,
        status: 'PUBLISHED',
        publishedAt: new Date('2026-03-01T12:00:00Z'),
        creator: { id: creator.id, username: 'autor', displayName: 'Autor', avatarUrl: null, status: 'ACTIVE' },
      };
      db.intent.findUnique.mockResolvedValue(alreadyPublished);

      const res = await fetch(`${baseUrl}/v1/intents/${draftIntentId}/publish`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token-creator' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe('PUBLISHED');
      expect(db.intent.update).not.toHaveBeenCalled();
      expect(db.domainEvent.create).not.toHaveBeenCalled();
    });

    it('rejeita tentativa de publicar uma Intent cancelada', async () => {
      const cancelledIntent = {
        ...mockDraft,
        status: 'CANCELLED',
        creator: { id: creator.id, status: 'ACTIVE' },
      };
      db.intent.findUnique.mockResolvedValue(cancelledIntent);

      const res = await fetch(`${baseUrl}/v1/intents/${draftIntentId}/publish`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token-creator' },
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.code).toBe('CANNOT_PUBLISH_CANCELLED');
    });
  });
});
