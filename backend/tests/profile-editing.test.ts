import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateProfileSchema } from '../src/domain/intent-schemas.js';

// Setup de mocks do Prisma e Firebase Auth para testes HTTP
const { db, verifyIdToken } = vi.hoisted(() => ({
  db: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  verifyIdToken: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({ prisma: db }));
vi.mock('../src/lib/firebase.js', () => ({ firebaseAuth: { verifyIdToken } }));
vi.mock('../src/config.js', () => ({
  config: {
    corsOrigins: ['http://localhost:3000'],
    logLevel: 'silent',
    revealEncryptionKey: Buffer.alloc(32, 7),
  },
}));

import { createApp } from '../src/app.js';

const testUser = {
  id: '30000000-0000-4000-8000-000000000001',
  firebaseUid: 'test-user-firebase-uid',
  email: 'usuario.teste@example.com',
  username: 'perfil_valido',
  displayName: 'Nome Original',
  bio: 'Biografia inicial',
  avatarUrl: 'https://example.com/original.jpg',
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  passwordHash: 'secret_hash',
  tokens: ['token_1'],
};

describe('Validação de Schemas de Edição de Perfil (updateProfileSchema)', () => {
  it('valida com sucesso payload completo de edição', () => {
    const input = {
      displayName: 'Nome Atualizado',
      bio: 'Nova biografia detalhada.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
    };
    const parsed = updateProfileSchema.parse(input);
    expect(parsed).toEqual(input);
  });

  it('permite atualizar apenas o nome de exibição', () => {
    const parsed = updateProfileSchema.parse({ displayName: 'Apenas Nome' });
    expect(parsed).toEqual({ displayName: 'Apenas Nome' });
  });

  it('permite atualizar apenas a bio', () => {
    const parsed = updateProfileSchema.parse({ bio: 'Apenas nova bio' });
    expect(parsed).toEqual({ bio: 'Apenas nova bio' });
  });

  it('permite limpar a bio passando null', () => {
    const parsed = updateProfileSchema.parse({ bio: null });
    expect(parsed).toEqual({ bio: null });
  });

  it('permite atualizar apenas o avatar', () => {
    const parsed = updateProfileSchema.parse({ avatarUrl: 'https://example.com/novo.png' });
    expect(parsed).toEqual({ avatarUrl: 'https://example.com/novo.png' });
  });

  it('permite limpar o avatar passando null', () => {
    const parsed = updateProfileSchema.parse({ avatarUrl: null });
    expect(parsed).toEqual({ avatarUrl: null });
  });

  it('aplica trim automático no nome e bio', () => {
    const parsed = updateProfileSchema.parse({
      displayName: '   Nome Espaçado   ',
      bio: '   Bio com espaços   ',
    });
    expect(parsed.displayName).toBe('Nome Espaçado');
    expect(parsed.bio).toBe('Bio com espaços');
  });

  it('rejeita nome de exibição menor que 2 caracteres', () => {
    expect(updateProfileSchema.safeParse({ displayName: 'A' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ displayName: ' ' }).success).toBe(false);
  });

  it('rejeita nome de exibição maior que 120 caracteres', () => {
    expect(updateProfileSchema.safeParse({ displayName: 'a'.repeat(121) }).success).toBe(false);
  });

  it('rejeita bio maior que 500 caracteres', () => {
    expect(updateProfileSchema.safeParse({ bio: 'b'.repeat(501) }).success).toBe(false);
  });

  it('rejeita URL de avatar com formato inválido', () => {
    expect(updateProfileSchema.safeParse({ avatarUrl: 'not-a-url' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ avatarUrl: 'http://' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ avatarUrl: '//no-protocol' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ avatarUrl: 'invalid_url_string' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ avatarUrl: 'https:// example .com' }).success).toBe(false);
  });

  it('rejeita payload vazio', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
  });

  it.each([
    'id',
    'username',
    'email',
    'firebaseUid',
    'status',
    'role',
    'passwordHash',
    'tokens',
    'createdAt',
    'updatedAt',
  ])('rejeita estritamente a tentativa de alterar o campo protegido: %s', (field) => {
    expect(updateProfileSchema.safeParse({ [field]: 'novo_valor' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ displayName: 'Válido', [field]: 'novo_valor' }).success).toBe(false);
  });
});

describe('Endpoint HTTP PATCH /v1/users/me (Edição de Perfil Social)', () => {
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
    vi.resetAllMocks();
    verifyIdToken.mockResolvedValue({ uid: testUser.firebaseUid, name: testUser.displayName });
    db.user.findUnique.mockResolvedValue(testUser);
    db.user.update.mockResolvedValue(testUser);
  });

  function patchMe(body: unknown, authenticated = true) {
    return fetch(`${baseUrl}/v1/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(authenticated ? { Authorization: 'Bearer valid-test-token' } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  it('retorna 401 Unauthorized se o usuário não estiver autenticado', async () => {
    const response = await patchMe({ displayName: 'Novo Nome' }, false);
    expect(response.status).toBe(401);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('atualiza nome, bio e avatar com sucesso para o usuário autenticado', async () => {
    const updatedUser = {
      ...testUser,
      displayName: 'Nome Atualizado',
      bio: 'Nova Biografia',
      avatarUrl: 'https://example.com/nova-foto.jpg',
    };
    db.user.update.mockResolvedValue(updatedUser);

    const response = await patchMe({
      displayName: 'Nome Atualizado',
      bio: 'Nova Biografia',
      avatarUrl: 'https://example.com/nova-foto.jpg',
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      data: {
        id: testUser.id,
        username: testUser.username,
        displayName: 'Nome Atualizado',
        bio: 'Nova Biografia',
        avatarUrl: 'https://example.com/nova-foto.jpg',
        createdAt: testUser.createdAt.toISOString(),
        updatedAt: testUser.updatedAt.toISOString(),
      },
    });

    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: testUser.id },
        data: {
          displayName: 'Nome Atualizado',
          bio: 'Nova Biografia',
          avatarUrl: 'https://example.com/nova-foto.jpg',
        },
      }),
    );
  });

  it('não expõe campos privados (email, hash, tokens, firebaseUid) na resposta', async () => {
    db.user.update.mockResolvedValue(testUser);
    const response = await patchMe({ displayName: 'Nome Seguro' });
    const body = await response.json();

    expect(body.data).not.toHaveProperty('email');
    expect(body.data).not.toHaveProperty('passwordHash');
    expect(body.data).not.toHaveProperty('tokens');
    expect(body.data).not.toHaveProperty('firebaseUid');
  });

  it('retorna 400 Validation Error se o payload for inválido', async () => {
    const response = await patchMe({ displayName: '' });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});
