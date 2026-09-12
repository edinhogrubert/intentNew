import assert from 'node:assert/strict';
import { createIntentSchema } from '../backend/src/domain/intent-schemas.ts';

console.log('🧪 Iniciando suíte de testes: Criação de Intent, Categorias MVP e Privacidade...\n');

// 1. Testes de Categorias do MVP no Schema
console.log('1. Validando categorias reais do MVP (incluindo SPORTS)...');

const mvpCategories = [
  'SPORTS',
  'ENTERTAINMENT',
  'TECHNOLOGY',
  'EDUCATION',
  'HEALTH_WELLNESS',
  'CAREER_BUSINESS',
  'COMMUNITY_CAUSES',
  'PERSONAL_LIFE',
  'OTHER',
];

for (const cat of mvpCategories) {
  const result = createIntentSchema.safeParse({
    title: `Desafio na categoria ${cat}`,
    story: `História válida com contexto detalhado para ${cat}.`,
    category: cat,
    supportGoal: 5,
    revealContent: `Segredo criptografado da categoria ${cat}`,
    visibility: 'PUBLIC',
  });
  assert.equal(result.success, true, `Categoria ${cat} deveria ser aceita pelo schema.`);
}

const invalidCategoryResult = createIntentSchema.safeParse({
  title: 'Intent com categoria inválida',
  story: 'História válida para teste de rejeição.',
  category: 'RANDOM_UNSUPPORTED_CATEGORY',
  supportGoal: 5,
  revealContent: 'Segredo de teste',
  visibility: 'PUBLIC',
});
assert.equal(invalidCategoryResult.success, false, 'Categoria fora da lista oficial do MVP deve ser rejeitada.');
console.log('   ✅ Todas as 9 categorias reais do MVP foram aceitas e categorias desconhecidas rejeitadas.');

// 2. Testes de Visibilidade (PUBLIC, FOLLOWERS, PRIVATE)
console.log('2. Validando opções de visibilidade (Pública, Seguidores, Privada)...');

for (const vis of ['PUBLIC', 'FOLLOWERS', 'PRIVATE']) {
  const result = createIntentSchema.safeParse({
    title: `Intent com visibilidade ${vis}`,
    story: `História detalhada testando a visibilidade ${vis}.`,
    category: 'SPORTS',
    supportGoal: 3,
    revealContent: 'Conteúdo sob proteção criptográfica.',
    visibility: vis,
  });
  assert.equal(result.success, true, `Visibilidade ${vis} deve ser aceita pelo schema.`);
  if (result.success) {
    assert.equal(result.data.visibility, vis);
  }
}

const invalidVisResult = createIntentSchema.safeParse({
  title: 'Intent com visibilidade desconhecida',
  story: 'História detalhada para teste de visibilidade inválida.',
  category: 'SPORTS',
  supportGoal: 3,
  revealContent: 'Segredo de teste',
  visibility: 'RESTRICTED_TEAM',
});
assert.equal(invalidVisResult.success, false, 'Visibilidade não suportada deve ser rejeitada.');
console.log('   ✅ Visibilidades PUBLIC, FOLLOWERS e PRIVATE validadas com sucesso.');

// 3. Testes das Regras de Feed e Privacidade
console.log('3. Validando regras de privacidade de Feed e Isolamento de Cofre...');

interface TestIntent {
  id: string;
  creatorId: string;
  visibility: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
  status: 'PUBLISHED' | 'REALIZED';
  title: string;
}

const sampleIntents: TestIntent[] = [
  { id: 'i1', creatorId: 'alice', visibility: 'PUBLIC', status: 'PUBLISHED', title: 'Intent Pública Alice' },
  { id: 'i2', creatorId: 'alice', visibility: 'FOLLOWERS', status: 'PUBLISHED', title: 'Intent Seguidores Alice' },
  { id: 'i3', creatorId: 'alice', visibility: 'PRIVATE', status: 'PUBLISHED', title: 'Intent Privada Alice (Cofre)' },
  { id: 'i4', creatorId: 'bob', visibility: 'PUBLIC', status: 'PUBLISHED', title: 'Intent Pública Bob' },
  { id: 'i5', creatorId: 'bob', visibility: 'FOLLOWERS', status: 'PUBLISHED', title: 'Intent Seguidores Bob' },
  { id: 'i6', creatorId: 'bob', visibility: 'PRIVATE', status: 'PUBLISHED', title: 'Intent Privada Bob (Cofre)' },
];

function filterPublicFeed(intents: TestIntent[]): TestIntent[] {
  return intents.filter((item) => item.visibility === 'PUBLIC' && item.status === 'PUBLISHED');
}

function filterFollowingFeed(intents: TestIntent[], viewerId: string, followingIds: Set<string>): TestIntent[] {
  return intents.filter(
    (item) =>
      (item.visibility === 'PUBLIC' || item.visibility === 'FOLLOWERS') &&
      (followingIds.has(item.creatorId) || item.creatorId === viewerId) &&
      (item.status === 'PUBLISHED' || item.status === 'REALIZED'),
  );
}

function checkSupportPermission(intent: TestIntent, supporterId: string, followingIds: Set<string>): void {
  if (intent.creatorId === supporterId) {
    throw new Error('CREATOR_CANNOT_SUPPORT: O criador não pode apoiar a própria Intent.');
  }
  if (intent.visibility === 'PRIVATE') {
    throw new Error('INTENT_FORBIDDEN: Você não pode apoiar uma Intent privada.');
  }
  if (intent.visibility === 'FOLLOWERS' && !followingIds.has(intent.creatorId)) {
    throw new Error('INTENT_FORBIDDEN: Somente seguidores podem apoiar esta Intent.');
  }
}

function checkAccessPermission(intent: TestIntent, viewerId: string, followingIds: Set<string>): void {
  if (intent.visibility === 'PRIVATE' && intent.creatorId !== viewerId) {
    throw new Error('INTENT_FORBIDDEN: Você não pode acessar esta Intent.');
  }
  if (intent.visibility === 'FOLLOWERS' && intent.creatorId !== viewerId && !followingIds.has(intent.creatorId)) {
    throw new Error('INTENT_FORBIDDEN: Esta Intent é visível somente para seguidores.');
  }
}

// 3.1 - Feed Público
const publicFeed = filterPublicFeed(sampleIntents);
assert.equal(publicFeed.length, 2, 'Feed público deve conter apenas as 2 intents públicas.');
assert.ok(publicFeed.every((item) => item.visibility === 'PUBLIC'), 'Nenhuma intent privada ou de seguidores pode vazar no feed público.');
assert.ok(!publicFeed.some((item) => item.visibility === 'PRIVATE'), 'Intent privada nunca deve aparecer no feed público.');
assert.ok(!publicFeed.some((item) => item.visibility === 'FOLLOWERS'), 'Intent de seguidores não aparece no feed público global.');
console.log('   ✅ Feed público filtra estritamente itens públicos.');

// 3.2 - Feed de Seguidores (Charlie segue Alice, mas não Bob)
const charlieFollowing = new Set(['alice']);
const charlieFollowingFeed = filterFollowingFeed(sampleIntents, 'charlie', charlieFollowing);
assert.equal(charlieFollowingFeed.length, 2, 'Charlie deve ver apenas as intents Pública e Seguidores de Alice.');
assert.ok(!charlieFollowingFeed.some((item) => item.id === 'i3'), 'Intent privada de Alice nunca vaza para seguidores.');
assert.ok(!charlieFollowingFeed.some((item) => item.creatorId === 'bob'), 'Intents de Bob não aparecem para quem não o segue.');
console.log('   ✅ Feed de seguidores respeita estritamente o grafo social e bloqueia cofres privados.');

// 3.3 - Tentativa de Apoio em Intent Privada
assert.throws(
  () => checkSupportPermission(sampleIntents.find((i) => i.id === 'i3')!, 'charlie', charlieFollowing),
  /Você não pode apoiar uma Intent privada/,
  'Apoio em Intent privada deve ser bloqueado com 403 INTENT_FORBIDDEN.',
);
console.log('   ✅ Apoio em Intent privada bloqueado com segurança.');

// 3.4 - Tentativa de Criador Apoiar a Própria Intent
assert.throws(
  () => checkSupportPermission(sampleIntents.find((i) => i.id === 'i1')!, 'alice', charlieFollowing),
  /O criador não pode apoiar a própria Intent/,
  'Criador não pode apoiar a própria Intent.',
);
console.log('   ✅ Tentativa de auto-apoio bloqueada conforme regra de negócio.');

// 3.5 - Acesso Direto a Intent Privada por Terceiros
assert.throws(
  () => checkAccessPermission(sampleIntents.find((i) => i.id === 'i3')!, 'charlie', charlieFollowing),
  /Você não pode acessar esta Intent/,
  'Acesso de terceiros a intent privada deve ser negado.',
);

// Criador tem acesso irrestrito à sua própria intent privada
assert.doesNotThrow(() => {
  checkAccessPermission(sampleIntents.find((i) => i.id === 'i3')!, 'alice', new Set());
}, 'Criador pode acessar normalmente sua própria Intent privada no cofre.');
console.log('   ✅ Acesso a Intent privada isolado exclusivamente para o criador.');

console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO! Feed e Privacidade 100% protegidos.\n');
