import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openReveal, sealReveal, revealAssociatedData } from '../src/domain/reveal-crypto.js';

// Only the persistence boundary is replaced. Services and reveal encryption are real.
const { db, key } = vi.hoisted(() => ({
  key: Buffer.alloc(32, 7), // Synthetic test key, never a production credential.
  db: {
    $transaction: vi.fn(),
    user: { findUnique: vi.fn() },
    intent: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    follow: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    support: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
    domainEvent: { create: vi.fn() },
  },
}));
vi.mock('../src/lib/prisma.js', () => ({ prisma: db }));
vi.mock('../src/config.js', () => ({ config: { revealEncryptionKey: key } }));

import { createIntent, getIntent, listFollowingFeed, listPublicFeed, removeSupport, supportIntent } from '../src/services/intent-service.js';
import { followUser, unfollowUser } from '../src/services/social-service.js';

const creatorId = '10000000-0000-4000-8000-000000000001';
const viewerId = '10000000-0000-4000-8000-000000000002';
const intentId = '20000000-0000-4000-8000-000000000001';
const creator = { id: creatorId, username: 'criador', displayName: 'Criador', avatarUrl: null, status: 'ACTIVE' };
const intent = {
  id: intentId, creatorId, creator, visibility: 'PUBLIC', status: 'PUBLISHED',
  supportCount: 0, supportGoal: 3, revealVersion: 1,
  revealCiphertext: 'not-public', revealIv: 'not-public', revealAuthTag: 'not-public',
};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async (operation: (transaction: typeof db) => Promise<unknown>) => operation(db));
  db.intent.findUnique.mockResolvedValue({ ...intent });
  db.user.findUnique.mockResolvedValue(creator);
  db.follow.findUnique.mockResolvedValue(null);
  db.support.findUnique.mockResolvedValue(null);
  db.domainEvent.create.mockResolvedValue({});
});

describe('criação e acesso às Intents', () => {
  it.each(['PUBLIC', 'FOLLOWERS'] as const)('cria Intent %s com revelação cifrada e evento correspondente', async (visibility) => {
    db.intent.create.mockResolvedValue({ id: intentId, visibility });
    const command = { title: 'Uma intenção de teste', story: 'História de teste', category: 'OTHER', supportGoal: 3, revealContent: 'Revelação de teste', visibility };
    await createIntent(creatorId, command);
    const args = db.intent.create.mock.calls[0]![0];
    expect(args.data).toMatchObject({ creatorId, visibility, supportGoal: 3 });
    expect(args.data.revealCiphertext).not.toBe(command.revealContent);
    expect(args.data).not.toHaveProperty('revealContent');
    expect(openReveal({ ciphertext: args.data.revealCiphertext, iv: args.data.revealIv, authTag: args.data.revealAuthTag }, key, revealAssociatedData(args.data.id, 1))).toBe(command.revealContent);
    expect(db.domainEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'INTENT_CREATED', actorId: creatorId, payload: expect.objectContaining({ visibility }) }) }));
    expect(args.select).not.toHaveProperty('revealCiphertext');
    expect(args.select).not.toHaveProperty('revealIv');
    expect(args.select).not.toHaveProperty('revealAuthTag');
  });

  it('permite detalhe público anônimo sem expor revelação antes da meta', async () => {
    const result = await getIntent(intentId);
    expect(result).toMatchObject({ id: intentId, revealContent: null, viewerHasSupported: false });
    for (const field of ['revealCiphertext', 'revealIv', 'revealAuthTag']) expect(result).not.toHaveProperty(field);
    expect(db.follow.findUnique).not.toHaveBeenCalled();
  });

  it('permite ao criador acessar sua Intent exclusiva sem seguir a si mesmo', async () => {
    db.intent.findUnique.mockResolvedValue({ ...intent, visibility: 'FOLLOWERS' });
    await expect(getIntent(intentId, creatorId)).resolves.toMatchObject({ id: intentId });
    expect(db.follow.findUnique).not.toHaveBeenCalled();
  });

  it('permite acesso ao seguidor e consulta o vínculo na direção correta', async () => {
    db.intent.findUnique.mockResolvedValue({ ...intent, visibility: 'FOLLOWERS' });
    db.follow.findUnique.mockResolvedValue({ id: 'relation' });
    await expect(getIntent(intentId, viewerId)).resolves.toMatchObject({ id: intentId, revealContent: null });
    expect(db.follow.findUnique).toHaveBeenCalledWith({ where: { followerId_followingId: { followerId: viewerId, followingId: creatorId } }, select: { id: true } });
  });

  it.each([undefined, viewerId])('bloqueia visitante sem vínculo (%s) na Intent exclusiva', async (viewer) => {
    db.intent.findUnique.mockResolvedValue({ ...intent, visibility: 'FOLLOWERS' });
    await expect(getIntent(intentId, viewer)).rejects.toMatchObject({ statusCode: 403, code: 'INTENT_FORBIDDEN' });
    expect(db.support.findUnique).not.toHaveBeenCalled();
  });

  it('bloqueia não seguidor mesmo após realização, antes de tentar decifrar', async () => {
    db.intent.findUnique.mockResolvedValue({ ...intent, visibility: 'FOLLOWERS', status: 'REALIZED' });
    await expect(getIntent(intentId, viewerId)).rejects.toMatchObject({ code: 'INTENT_FORBIDDEN' });
  });
});

describe('seguir e deixar de seguir', () => {
  beforeEach(() => {
    db.user.findUnique.mockResolvedValue(creator);
    db.intent.count.mockResolvedValue(0);
    db.intent.findMany.mockResolvedValue([]);
    db.follow.count.mockResolvedValue(0);
    db.support.count.mockResolvedValue(0);
  });

  it('seguir, repetir, deixar de seguir e voltar a seguir atualizam acesso e perfil', async () => {
    // Minimal relation store: deliberately no visibility logic in the test double.
    const relations = new Set<string>();
    db.follow.upsert.mockImplementation(async ({ create }) => {
      relations.add(`${create.followerId}:${create.followingId}`);
      return { id: 'relation' };
    });
    db.follow.deleteMany.mockImplementation(async ({ where }) => ({ count: Number(relations.delete(`${where.followerId}:${where.followingId}`)) }));
    db.follow.findUnique.mockImplementation(async ({ where }) => {
      const pair = where.followerId_followingId;
      return relations.has(`${pair.followerId}:${pair.followingId}`) ? { id: 'relation' } : null;
    });
    db.intent.findUnique.mockResolvedValue({ ...intent, visibility: 'FOLLOWERS' });

    // The reverse relation does not grant the viewer access.
    relations.add(`${creatorId}:${viewerId}`);
    await expect(getIntent(intentId, viewerId)).rejects.toMatchObject({ code: 'INTENT_FORBIDDEN' });
    expect((await followUser(viewerId, creatorId)).isFollowing).toBe(true);
    expect((await followUser(viewerId, creatorId)).isFollowing).toBe(true);
    expect(relations.size).toBe(2);
    await expect(getIntent(intentId, viewerId)).resolves.toMatchObject({ id: intentId });
    expect((await unfollowUser(viewerId, creatorId)).isFollowing).toBe(false);
    await expect(getIntent(intentId, viewerId)).rejects.toMatchObject({ code: 'INTENT_FORBIDDEN' });
    expect((await unfollowUser(viewerId, creatorId)).isFollowing).toBe(false);
    expect((await followUser(viewerId, creatorId)).isFollowing).toBe(true);
    await expect(getIntent(intentId, viewerId)).resolves.toMatchObject({ id: intentId });
  });

  it('não permite seguir a própria conta', async () => {
    await expect(followUser(creatorId, creatorId)).rejects.toMatchObject({ code: 'SELF_FOLLOW_NOT_ALLOWED' });
    expect(db.follow.upsert).not.toHaveBeenCalled();
  });

  it.each([null, { ...creator, status: 'INACTIVE' }])('não permite seguir perfil ausente ou inativo (%s)', async (target) => {
    db.user.findUnique.mockResolvedValue(target);
    await expect(followUser(viewerId, creatorId)).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
    expect(db.follow.upsert).not.toHaveBeenCalled();
  });
});

describe('contratos de consulta dos feeds', () => {
  // Query contracts are checked explicitly, rather than reimplementing Prisma's filters.
  it('Para você exige visibilidade pública e criador ativo, sem exigir vínculo', async () => {
    db.intent.findMany.mockResolvedValue([{ id: intentId }]);
    expect(await listPublicFeed()).toEqual({ items: [{ id: intentId }], nextCursor: null });
    expect(db.intent.findMany.mock.calls[0]![0].where).toEqual({ visibility: 'PUBLIC', status: { in: ['PUBLISHED', 'REALIZED'] }, creator: { status: 'ACTIVE' } });
  });

  it('Seguindo aceita públicas e exclusivas apenas de criadores ativos seguidos pelo visitante', async () => {
    db.intent.findMany.mockResolvedValue([]);
    expect(await listFollowingFeed(viewerId)).toEqual({ items: [], nextCursor: null });
    expect(db.intent.findMany.mock.calls[0]![0].where).toEqual({ visibility: { in: ['PUBLIC', 'FOLLOWERS'] }, status: { in: ['PUBLISHED', 'REALIZED'] }, creator: { status: 'ACTIVE', followers: { some: { followerId: viewerId } } } });
  });

  it.each(['public', 'following'] as const)('pagina o feed %s sem entregar o item extra ou selecionar segredos', async (scope) => {
    db.intent.findMany.mockResolvedValue([{ id: 'first' }, { id: 'second' }, { id: 'extra' }]);
    const result = scope === 'public' ? await listPublicFeed('cursor', 2) : await listFollowingFeed(viewerId, 'cursor', 2);
    expect(result).toEqual({ items: [{ id: 'first' }, { id: 'second' }], nextCursor: 'second' });
    const query = db.intent.findMany.mock.calls[0]![0];
    expect(query).toMatchObject({ take: 3, cursor: { id: 'cursor' }, skip: 1, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    for (const field of ['revealCiphertext', 'revealIv', 'revealAuthTag', 'revealContent']) expect(query.select).not.toHaveProperty(field);
  });
});

describe('apoio alternável', () => {
  it('apoia, retira e apoia novamente, mantendo contagem, estado do visitante e eventos', async () => {
    db.support.create.mockResolvedValueOnce({ id: 'support-1' }).mockResolvedValueOnce({ id: 'support-2' });
    db.intent.update.mockResolvedValueOnce({ ...intent, supportCount: 1 }).mockResolvedValueOnce({ ...intent, supportCount: 0 }).mockResolvedValueOnce({ ...intent, supportCount: 1 });
    expect(await supportIntent(intentId, viewerId)).toMatchObject({ supported: true, supportCount: 1, realized: false });
    db.support.findUnique.mockResolvedValue({ id: 'support-1' });
    expect((await getIntent(intentId, viewerId)).viewerHasSupported).toBe(true);
    db.intent.findUnique.mockResolvedValue({ ...intent, supportCount: 1 });
    expect(await removeSupport(intentId, viewerId)).toMatchObject({ supported: false, removed: true, supportCount: 0 });
    expect(db.support.delete).toHaveBeenCalledWith({ where: { id: 'support-1' } });
    db.support.findUnique.mockResolvedValue(null);
    db.intent.findUnique.mockResolvedValue({ ...intent });
    expect((await getIntent(intentId, viewerId)).viewerHasSupported).toBe(false);
    expect(await supportIntent(intentId, viewerId)).toMatchObject({ supported: true, supportCount: 1 });
    expect(db.intent.update.mock.calls.map(([args]) => args.data)).toEqual([{ supportCount: { increment: 1 } }, { supportCount: { decrement: 1 } }, { supportCount: { increment: 1 } }]);
    expect(db.domainEvent.create.mock.calls.map(([args]) => [args.data.type, args.data.idempotencyKey])).toEqual([
      ['SUPPORT_RECEIVED', 'support-received:support-1'],
      ['SUPPORT_REMOVED', 'support-removed:support-1'],
      ['SUPPORT_RECEIVED', 'support-received:support-2'],
    ]);
    expect(db.support.create).toHaveBeenCalledWith({ data: { intentId, userId: viewerId } });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });

  it('retirar um apoio inexistente não reduz contador nem emite evento', async () => {
    expect(await removeSupport(intentId, viewerId)).toMatchObject({ supported: false, removed: false, supportCount: 0 });
    expect(db.support.delete).not.toHaveBeenCalled();
    expect(db.intent.update).not.toHaveBeenCalled();
    expect(db.domainEvent.create).not.toHaveBeenCalled();
  });

  it('rejeita apoio duplicado sem incrementar contador', async () => {
    db.support.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6.19.0' }));
    await expect(supportIntent(intentId, viewerId)).rejects.toMatchObject({ statusCode: 409, code: 'SUPPORT_ALREADY_EXISTS' });
    expect(db.intent.update).not.toHaveBeenCalled();
  });

  it('não permite apoio do criador', async () => {
    await expect(supportIntent(intentId, creatorId)).rejects.toMatchObject({ code: 'CREATOR_CANNOT_SUPPORT' });
    expect(db.support.create).not.toHaveBeenCalled();
  });

  it('bloqueia apoio de não seguidor em Intent exclusiva', async () => {
    db.intent.findUnique.mockResolvedValue({ ...intent, visibility: 'FOLLOWERS' });
    await expect(supportIntent(intentId, viewerId)).rejects.toMatchObject({ code: 'INTENT_FORBIDDEN' });
    expect(db.support.create).not.toHaveBeenCalled();
    expect(db.intent.update).not.toHaveBeenCalled();
  });

  it('permite apoio do seguidor em Intent exclusiva', async () => {
    db.intent.findUnique.mockResolvedValue({ ...intent, visibility: 'FOLLOWERS' });
    db.follow.findUnique.mockResolvedValue({ id: 'relation' });
    db.support.create.mockResolvedValue({ id: 'support-1' });
    db.intent.update.mockResolvedValue({ ...intent, supportCount: 1 });
    await expect(supportIntent(intentId, viewerId)).resolves.toMatchObject({ supported: true });
    expect(db.follow.findUnique).toHaveBeenCalledWith({ where: { followerId_followingId: { followerId: viewerId, followingId: creatorId } }, select: { id: true } });
  });

  it('realiza ao atingir a meta e impede retirar apoio depois', async () => {
    db.support.create.mockResolvedValue({ id: 'last-support' });
    db.intent.update.mockResolvedValue({ ...intent, supportCount: 3 });
    db.intent.updateMany.mockResolvedValue({ count: 1 });
    expect(await supportIntent(intentId, viewerId)).toMatchObject({ supportCount: 3, realized: true, realizedNow: true });
    expect(db.intent.updateMany).toHaveBeenCalledWith({ where: { id: intentId, status: 'PUBLISHED' }, data: { status: 'REALIZED', realizedAt: expect.any(Date) } });
    expect(db.domainEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'INTENT_REALIZED' }) }));
    db.intent.findUnique.mockResolvedValue({ ...intent, status: 'REALIZED', supportCount: 3 });
    await expect(removeSupport(intentId, viewerId)).rejects.toMatchObject({ code: 'SUPPORT_LOCKED_AFTER_REVEAL' });
    expect(db.support.delete).not.toHaveBeenCalled();
  });
});


describe('fundação de autoridade', () => {
  it('valida o comando também na fronteira do serviço', async () => {
    await expect(createIntent(creatorId, {
      title: 'Uma Intent', story: 'Uma história', supportGoal: 1, revealContent: 'segredo', status: 'REALIZED',
    })).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it.each(['PRIVATE', 'FOLLOWERS'])('mantém acesso do criador à revelação %s após a meta', async (visibility) => {
    const sealed = sealReveal('conteúdo protegido', key, revealAssociatedData(intentId, 1));
    db.intent.findUnique.mockResolvedValue({ ...intent, visibility, status: 'REALIZED', supportCount: 3,
      realizedAt: new Date(), revealCiphertext: sealed.ciphertext, revealIv: sealed.iv, revealAuthTag: sealed.authTag });
    await expect(getIntent(intentId, viewerId)).rejects.toMatchObject({ code: 'INTENT_FORBIDDEN' });
    const result = await getIntent(intentId, creatorId);
    expect(result.revealContent).toBe('conteúdo protegido');
    expect(result).not.toHaveProperty('revealCiphertext');
  });

  it.each([{ visibility: 'UNKNOWN' }, { status: 'RELEASED' }])('nega acesso para valores desconhecidos: %j', async (state) => {
    db.intent.findUnique.mockResolvedValue({ ...intent, ...state });
    await expect(getIntent(intentId, creatorId)).rejects.toMatchObject({ code: 'INTENT_FORBIDDEN' });
  });

  it.each([{ supportCount: 2, realizedAt: new Date() }, { supportCount: 3, realizedAt: null }])('não decifra estado realizado inconsistente: %j', async (state) => {
    db.intent.findUnique.mockResolvedValue({ ...intent, status: 'REALIZED', ...state });
    await expect(getIntent(intentId, creatorId)).rejects.toMatchObject({ code: 'INTENT_STATE_INVALID' });
  });

  it('repetir apoio não duplica contador nem evento', async () => {
    db.support.create.mockResolvedValueOnce({ id: 'support-1' }).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6.19.0' }));
    db.intent.update.mockResolvedValue({ ...intent, supportCount: 1 });
    await supportIntent(intentId, viewerId);
    await expect(supportIntent(intentId, viewerId)).rejects.toMatchObject({ code: 'SUPPORT_ALREADY_EXISTS' });
    expect(db.intent.update).toHaveBeenCalledTimes(1);
    expect(db.domainEvent.create).toHaveBeenCalledTimes(1);
    expect(db.domainEvent.create.mock.calls[0]![0].data.idempotencyKey).toBe('support-received:support-1');
  });

  it('aborta a transação se a transição de realização não acontecer', async () => {
    db.support.create.mockResolvedValue({ id: 'last-support' });
    db.intent.update.mockResolvedValue({ ...intent, supportCount: 3 });
    db.intent.updateMany.mockResolvedValue({ count: 0 });
    await expect(supportIntent(intentId, viewerId)).rejects.toMatchObject({ code: 'INTENT_STATE_CONFLICT' });
    expect(db.domainEvent.create.mock.calls.map(([args]) => args.data.type)).not.toContain('INTENT_REALIZED');
  });

  it('repete conflitos de serialização e publica somente o evento da tentativa confirmada', async () => {
    db.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('serialization', {
      code: 'P2034', clientVersion: '6.19.0',
    }));
    db.support.create.mockResolvedValue({ id: 'support-1' });
    db.intent.update.mockResolvedValue({ ...intent, supportCount: 1 });
    await expect(supportIntent(intentId, viewerId)).resolves.toMatchObject({ supportCount: 1, realized: false });
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(db.domainEvent.create).toHaveBeenCalledTimes(1);
  });
});


describe('atomicidade entre estado e auditoria', () => {
  it('falha de auditoria reverte apoio, contador e realização; nova tentativa confirma uma única realização', async () => {
    // Transaction double models commit/rollback only; domain decisions remain in the real service.
    let state = { ...intent, supportCount: 2, realizedAt: null as Date | null };
    let supports: string[] = [];
    let events: string[] = [];
    let rejectAudit = true;
    db.$transaction.mockImplementation(async (operation) => {
      const snapshot = { state: { ...state }, supports: [...supports], events: [...events] };
      try { return await operation(db); }
      catch (error) {
        state = snapshot.state; supports = snapshot.supports; events = snapshot.events;
        throw error;
      }
    });
    db.intent.findUnique.mockImplementation(async () => ({ ...state }));
    db.support.create.mockImplementation(async () => { supports.push(viewerId); return { id: 'last-support' }; });
    db.intent.update.mockImplementation(async () => { state.supportCount += 1; return { ...state }; });
    db.intent.updateMany.mockImplementation(async ({ data }) => { Object.assign(state, data); return { count: 1 }; });
    db.domainEvent.create.mockImplementation(async ({ data }) => {
      if (data.type === 'INTENT_REALIZED' && rejectAudit) throw new Error('audit unavailable');
      events.push(data.idempotencyKey);
      return {};
    });
    await expect(supportIntent(intentId, viewerId)).rejects.toThrow('audit unavailable');
    expect(state).toMatchObject({ status: 'PUBLISHED', supportCount: 2, supportGoal: 3, realizedAt: null });
    expect(supports).toEqual([]);
    expect(events).toEqual([]);
    rejectAudit = false;
    await expect(supportIntent(intentId, viewerId)).resolves.toMatchObject({ realizedNow: true, supportCount: 3 });
    await expect(supportIntent(intentId, viewerId)).rejects.toMatchObject({ code: 'INTENT_NOT_OPEN' });
    expect(state).toMatchObject({ status: 'REALIZED', supportCount: 3, supportGoal: 3, realizedAt: expect.any(Date) });
    expect(supports).toEqual([viewerId]);
    expect(events).toEqual(['support-received:last-support', `intent-realized:${intentId}:v1`]);
  });
});

describe('Etapa 13 — permissões e consistência transacional', () => {
  const command = { title: 'Intent de teste', story: 'História de teste', supportGoal: 3, revealContent: 'segredo' };

  it.each([null, { status: 'SUSPENDED' }, { status: 'DELETED' }])('revalida conta na criação e alterações: %j', async (actor) => {
    db.user.findUnique.mockResolvedValue(actor);
    for (const operation of [
      () => createIntent(creatorId, command),
      () => supportIntent(intentId, viewerId),
      () => removeSupport(intentId, viewerId),
    ]) await expect(operation()).rejects.toMatchObject({ code: 'ACCOUNT_INACTIVE' });
    expect(db.intent.create).not.toHaveBeenCalled();
    expect(db.intent.update).not.toHaveBeenCalled();
    expect(db.support.create).not.toHaveBeenCalled();
    expect(db.support.delete).not.toHaveBeenCalled();
    expect(db.domainEvent.create).not.toHaveBeenCalled();
  });

  it('consulta o ator autenticado dentro da transação', async () => {
    await removeSupport(intentId, viewerId);
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { id: viewerId }, select: { status: true } });
    expect(db.user.findUnique.mock.invocationCallOrder[0]).toBeGreaterThan(db.$transaction.mock.invocationCallOrder[0]!);
  });

  it('nega apoio quando o criador está inativo', async () => {
    db.intent.findUnique.mockResolvedValue({ ...intent, creator: { ...creator, status: 'SUSPENDED' } });
    await expect(supportIntent(intentId, viewerId)).rejects.toMatchObject({ code: 'INTENT_NOT_FOUND' });
    expect(db.support.create).not.toHaveBeenCalled();
  });

  it.each(['PRIVATE', 'UNKNOWN'])('nega apoio com visibilidade %s', async (visibility) => {
    db.intent.findUnique.mockResolvedValue({ ...intent, visibility });
    await expect(supportIntent(intentId, viewerId)).rejects.toMatchObject({ code: 'INTENT_FORBIDDEN' });
    expect(db.support.create).not.toHaveBeenCalled();
  });

  it.each([
    { supportCount: -1 }, { supportCount: 0.5 }, { supportGoal: 0 },
    { supportCount: 3 }, { realizedAt: new Date('2026-09-01T00:00:00Z') },
  ])('não altera Intent publicada inconsistente: %j', async (state) => {
    db.intent.findUnique.mockResolvedValue({ ...intent, ...state });
    await expect(supportIntent(intentId, viewerId)).rejects.toMatchObject({ code: 'INTENT_STATE_INVALID' });
    await expect(removeSupport(intentId, viewerId)).rejects.toMatchObject({ code: 'INTENT_STATE_INVALID' });
    expect(db.support.create).not.toHaveBeenCalled();
    expect(db.support.delete).not.toHaveBeenCalled();
    expect(db.intent.update).not.toHaveBeenCalled();
    expect(db.domainEvent.create).not.toHaveBeenCalled();
  });

  it('não mascara apoio existente com contador zero na retirada', async () => {
    db.support.findUnique.mockResolvedValue({ id: 'support-1' });
    await expect(removeSupport(intentId, viewerId)).rejects.toMatchObject({ code: 'INTENT_STATE_INVALID' });
    expect(db.support.delete).not.toHaveBeenCalled();
  });

  it('retirada só procura apoio pertencente ao ator, mesmo se outro usuário apoiou', async () => {
    db.intent.findUnique.mockResolvedValue({ ...intent, supportCount: 1 });
    db.support.findUnique.mockResolvedValue(null);
    await expect(removeSupport(intentId, viewerId)).resolves.toMatchObject({ removed: false, supportCount: 1 });
    expect(db.support.findUnique).toHaveBeenCalledWith({ where: { intentId_userId: { intentId, userId: viewerId } } });
    expect(db.support.delete).not.toHaveBeenCalled();
    expect(db.domainEvent.create).not.toHaveBeenCalled();
  });

  it('preserva retirada do próprio apoio após deixar de seguir', async () => {
    db.intent.findUnique.mockResolvedValue({ ...intent, visibility: 'FOLLOWERS', supportCount: 1 });
    db.support.findUnique.mockResolvedValue({ id: 'support-1' });
    db.intent.update.mockResolvedValue({ ...intent, supportCount: 0 });
    await expect(removeSupport(intentId, viewerId)).resolves.toMatchObject({ removed: true, supportCount: 0 });
    expect(db.follow.findUnique).not.toHaveBeenCalled();
  });

  it('evento duplicado aborta a transação sem ser confundido com apoio duplicado', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('duplicate event', {
      code: 'P2002', clientVersion: '6.19.0', meta: { target: ['idempotency_key'] },
    });
    db.support.create.mockResolvedValue({ id: 'support-1' });
    db.intent.update.mockResolvedValue({ ...intent, supportCount: 1 });
    db.domainEvent.create.mockRejectedValue(duplicate);
    await expect(supportIntent(intentId, viewerId)).rejects.toBe(duplicate);
    expect(db.intent.updateMany).not.toHaveBeenCalled();
  });

  it('preserva metadados de Intent cancelada sem liberar conteúdo', async () => {
    db.intent.findUnique.mockResolvedValue({ ...intent, status: 'CANCELLED', visibility: 'PRIVATE' });
    await expect(getIntent(intentId, creatorId)).resolves.toMatchObject({ status: 'CANCELLED', revealContent: null });
    await expect(getIntent(intentId, viewerId)).rejects.toMatchObject({ code: 'INTENT_FORBIDDEN' });
  });
});
