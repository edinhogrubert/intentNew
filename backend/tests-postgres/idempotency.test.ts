import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Only the external token verifier is synthetic. HTTP, middleware, services,
// Prisma transactions, constraints and encryption are real.
vi.mock('../src/lib/firebase.js', () => ({ firebaseAuth: {
  verifyIdToken: async (token: string) => ({ uid: token }),
} }));
import { prisma } from '../src/lib/prisma.js';
import { createApp } from '../src/app.js';
import { createIntent, getIntent, supportIntent, removeSupport } from '../src/services/intent-service.js';
import { followUser, unfollowUser } from '../src/services/social-service.js';

let owner: string, alice: string, bob: string, ownerToken: string;
let server: Server;
let baseUrl: string;
const command = { title: 'Synthetic intent', story: 'Integration fixture', supportGoal: 3, revealContent: 'Synthetic protected content', visibility: 'PUBLIC' as const };
const key = () => randomUUID();
const create = (supportGoal = 3) => createIntent(owner, { ...command, supportGoal });

beforeAll(async () => {
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { stdio: 'pipe' });
  const users = await Promise.all(['owner', 'alice', 'bob'].map(name => prisma.user.create({ data: {
    firebaseUid: `${name}-${key()}`, username: `${name}_${key().slice(0,8)}`, displayName: name,
  } })));
  owner = users[0]!.id; alice = users[1]!.id; bob = users[2]!.id; ownerToken = users[0]!.firebaseUid;
  await new Promise<void>((resolve, reject) => {
    server = createApp().listen(0, '127.0.0.1', () => resolve()); server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  if (server?.listening) await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve()); server.closeAllConnections();
  });
  await prisma.$disconnect();
});

async function post(body: unknown, idempotencyKey?: string) {
  return fetch(`${baseUrl}/v1/intents`, { method: 'POST', headers: {
    Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json',
    ...(idempotencyKey === undefined ? {} : { 'Idempotency-Key': idempotencyKey }),
  }, body: JSON.stringify(body) });
}

async function counts(intentId: string) {
  return {
    supports: await prisma.support.count({ where: { intentId } }),
    events: await prisma.domainEvent.count({ where: { intentId } }),
    intent: await prisma.intent.findUniqueOrThrow({ where: { id: intentId } }),
  };
}

describe('idempotência persistida em PostgreSQL', () => {
  it('HTTP: criação repetida devolve mesmo status e JSON, sem outra Intent/evento', async () => {
    const token = key();
    const first = await post(command, token), original = await first.json();
    const second = await post({ ...command }, token);
    expect(first.status).toBe(201); expect(second.status).toBe(201);
    expect(await second.json()).toEqual(original);
    expect(await prisma.idempotencyRequest.count({ where: { actorId: owner, key: token } })).toBe(1);
    expect(await prisma.domainEvent.count({ where: { intentId: original.data.id } })).toBe(1);
  });

  it('HTTP: chave repetida com outros dados retorna 409 sem alterar a criação', async () => {
    const token = key(); await post(command, token);
    const response = await post({ ...command, supportGoal: 9 }, token);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: 'IDEMPOTENCY_KEY_REUSED' } });
  });

  it('criação com chaves diferentes produz Intents distintas', async () => {
    expect((await createIntent(owner, command, key())).id).not.toBe((await createIntent(owner, command, key())).id);
  });

  it('HTTP: ausência de header mantém criação sem deduplicação', async () => {
    const one = await (await post(command)).json(), two = await (await post(command)).json();
    expect(one.data.id).not.toBe(two.data.id);
  });

  it('HTTP: valida header e permite Idempotency-Key no preflight CORS', async () => {
    for (const token of ['', 'bad,key', 'x'.repeat(129)]) expect((await post(command, token)).status).toBe(400);
    const preflight = await fetch(`${baseUrl}/v1/intents`, { method: 'OPTIONS', headers: {
      Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Idempotency-Key',
    } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Headers')).toContain('Idempotency-Key');
  });

  it('mesma chave em usuários distintos cria registros independentes', async () => {
    const token = key();
    const one = await createIntent(owner, command, token), two = await createIntent(alice, command, token);
    expect(one.id).not.toBe(two.id);
    expect(await prisma.idempotencyRequest.count({ where: { key: token } })).toBe(2);
  });

  it('mesma chave em operações e Intents distintas tem escopos independentes', async () => {
    const one = await create(), two = await create(), token = key();
    await supportIntent(one.id, alice, token); await supportIntent(two.id, alice, token);
    expect((await removeSupport(one.id, alice, token)).removed).toBe(true);
    expect(await prisma.idempotencyRequest.count({ where: { actorId: alice, key: token } })).toBe(3);
  });

  it('apoio repetido após retirada retorna snapshot e não restaura participação; nova chave restaura', async () => {
    const target = await create(), token = key();
    const first = await supportIntent(target.id, alice, token);
    await removeSupport(target.id, alice, key());
    expect(await supportIntent(target.id, alice, token)).toEqual(first);
    expect((await counts(target.id)).supports).toBe(0);
    await supportIntent(target.id, alice, key());
    expect((await counts(target.id)).supports).toBe(1);
    expect(await prisma.domainEvent.count({ where: { intentId: target.id, type: 'SUPPORT_RECEIVED' } })).toBe(2);
  });

  it('retirada repetida após novo apoio não remove a nova participação', async () => {
    const target = await create(), token = key();
    await supportIntent(target.id, alice, key());
    const first = await removeSupport(target.id, alice, token);
    await supportIntent(target.id, alice, key());
    expect(await removeSupport(target.id, alice, token)).toEqual(first);
    const state = await counts(target.id);
    expect(state.supports).toBe(1); expect(state.intent.supportCount).toBe(1);
    expect(await prisma.domainEvent.count({ where: { intentId: target.id, type: 'SUPPORT_REMOVED' } })).toBe(1);
  });

  it('HTTP: headers de apoio e retirada preservam resposta sem reaplicar operação antiga', async () => {
    const target = await createIntent(alice, command), supportKey = key(), removeKey = key();
    const request = (method: string, token: string) => fetch(`${baseUrl}/v1/intents/${target.id}/supports`, {
      method, headers: { Authorization: `Bearer ${ownerToken}`, 'Idempotency-Key': token },
    });
    const first = await request('POST', supportKey); expect(first.status).toBe(201);
    const originalSupport = await first.json();
    const removed = await request('DELETE', removeKey); expect(removed.status).toBe(200);
    const originalRemoval = await removed.json();
    expect(await (await request('POST', supportKey)).json()).toEqual(originalSupport);
    expect((await counts(target.id)).supports).toBe(0);
    expect((await request('POST', key())).status).toBe(201);
    expect(await (await request('DELETE', removeKey)).json()).toEqual(originalRemoval);
    expect((await counts(target.id)).supports).toBe(1);
  });

  it('normaliza UUID do alvo para impedir duplicação de escopo por maiúsculas', async () => {
    const target = await create(), token = key();
    const first = await supportIntent(target.id, alice, token);
    await removeSupport(target.id, alice);
    expect(await supportIntent(target.id.toUpperCase(), alice, token)).toEqual(first);
    expect((await counts(target.id)).supports).toBe(0);
  });

  it('retirada inexistente também é lembrada e não afeta apoio posterior', async () => {
    const target = await create(), token = key();
    const first = await removeSupport(target.id, alice, token);
    expect(first.removed).toBe(false);
    await supportIntent(target.id, alice, key());
    expect(await removeSupport(target.id, alice, token)).toEqual(first);
    expect((await counts(target.id)).supports).toBe(1);
  });

  it('concorrência: mesma chave de criação confirma uma única Intent', async () => {
    const token = key();
    const results = await Promise.all(Array.from({ length: 5 }, () => createIntent(owner, command, token)));
    for (const result of results) expect(result).toEqual(results[0]);
    expect(await prisma.domainEvent.count({ where: { intentId: results[0]!.id } })).toBe(1);
  });

  it('concorrência: mesmo apoio que realiza confirma um apoio e uma realização', async () => {
    const target = await create(1), token = key();
    const results = await Promise.all(Array.from({ length: 5 }, () => supportIntent(target.id, alice, token)));
    for (const result of results) expect(result).toEqual(results[0]);
    const state = await counts(target.id);
    expect(state.supports).toBe(1); expect(state.intent.status).toBe('REALIZED'); expect(state.events).toBe(3);
  });

  it('concorrência: mesma retirada confirma uma única redução', async () => {
    const target = await create(), token = key(); await supportIntent(target.id, alice, key());
    const results = await Promise.all(Array.from({ length: 5 }, () => removeSupport(target.id, alice, token)));
    for (const result of results) expect(result).toEqual(results[0]);
    const state = await counts(target.id);
    expect(state.supports).toBe(0); expect(state.intent.supportCount).toBe(0); expect(state.events).toBe(3);
  });

  it('concorrência com chaves diferentes preserva realização única', async () => {
    const target = await create(2);
    await Promise.all([supportIntent(target.id, alice, key()), supportIntent(target.id, bob, key())]);
    const state = await counts(target.id);
    expect(state.intent.supportCount).toBe(2); expect(state.supports).toBe(2);
    expect(await prisma.domainEvent.count({ where: { intentId: target.id, type: 'INTENT_REALIZED' } })).toBe(1);
  });

  it.each(['CREATE_INTENT', 'SUPPORT_INTENT', 'REMOVE_SUPPORT'])('falha ao salvar resposta de %s reverte domínio e reserva; reenvio é seguro', async (operation) => {
    const token = key(), target = await create();
    if (operation === 'REMOVE_SUPPORT') await supportIntent(target.id, alice, key());
    const initial = await counts(target.id), total = await prisma.intent.count();
    const action = () => operation === 'CREATE_INTENT' ? createIntent(owner, command, token)
      : operation === 'SUPPORT_INTENT' ? supportIntent(target.id, alice, token) : removeSupport(target.id, alice, token);
    await prisma.$executeRawUnsafe(`CREATE FUNCTION test_reject_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic snapshot failure'; END $$`);
    await prisma.$executeRawUnsafe('CREATE TRIGGER test_reject_snapshot BEFORE UPDATE ON idempotency_requests FOR EACH ROW EXECUTE FUNCTION test_reject_snapshot()');
    try {
      await expect(action()).rejects.toThrow();
      expect(await counts(target.id)).toEqual(initial); expect(await prisma.intent.count()).toBe(total);
      expect(await prisma.idempotencyRequest.count({ where: { key: token } })).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER test_reject_snapshot ON idempotency_requests');
      await prisma.$executeRawUnsafe('DROP FUNCTION test_reject_snapshot()');
    }
    const result = await action(); expect(await action()).toEqual(result);
    expect(await prisma.idempotencyRequest.count({ where: { key: token } })).toBe(1);
  });

  it('resposta persistida sobrevive a nova conexão e não contém revelação ou comando', async () => {
    const token = key(), result = await createIntent(owner, command, token);
    const other = new PrismaClient();
    try {
      const record = await other.idempotencyRequest.findFirstOrThrow({ where: { key: token } });
      expect(record.response).toEqual(result);
      expect(JSON.stringify(record)).not.toContain(command.revealContent);
      await prisma.$disconnect();
      expect(await createIntent(owner, command, token)).toEqual(result);
    } finally { await other.$disconnect(); }
  });

  it('conta suspensa não obtém replay de operação anteriormente autorizada', async () => {
    const token = key(); await createIntent(bob, command, token);
    await prisma.user.update({ where: { id: bob }, data: { status: 'SUSPENDED' } });
    try { await expect(createIntent(bob, command, token)).rejects.toMatchObject({ code: 'ACCOUNT_INACTIVE' }); }
    finally { await prisma.user.update({ where: { id: bob }, data: { status: 'ACTIVE' } }); }
  });

  it('seguidores e acesso protegido continuam corretos com idempotência', async () => {
    const target = await createIntent(owner, { ...command, supportGoal: 1, visibility: 'FOLLOWERS' }, key());
    await expect(getIntent(target.id, alice)).rejects.toMatchObject({ code: 'INTENT_FORBIDDEN' });
    await followUser(alice, owner); await supportIntent(target.id, alice, key());
    expect((await getIntent(target.id, owner)).revealContent).toBe(command.revealContent);
    await unfollowUser(alice, owner);
    await expect(getIntent(target.id, alice)).rejects.toMatchObject({ code: 'INTENT_FORBIDDEN' });
  });
});
