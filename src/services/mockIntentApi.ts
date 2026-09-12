import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { createDefaultUserFields, getCurrentSessionUser, setCurrentSessionUser } from '../utils/storage';
import type { UserAccount } from '../types';
import type {
  ApiIntent,
  ApiSocialConnection,
  ApiSocialProfile,
  CreateSupportIntentInput,
  FeedScope,
  SupportIntentResult,
} from './intentApi';
import { IntentApiError } from './intentApi';

const LOCAL_MVP_INTENTS_KEY = 'intent_os_mvp_intents_v1';
const LOCAL_MVP_SUPPORTS_KEY = 'intent_os_mvp_supports_v1';
const LOCAL_MVP_FOLLOWS_KEY = 'intent_os_mvp_follows_v1';

const DEFAULT_SEED_INTENTS: ApiIntent[] = [
  {
    id: 'seed-intent-1',
    type: 'SUPPORT_REVEAL',
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    category: 'TECHNOLOGY',
    title: 'Lançamento do Protocolo Aberto de Intent Networks',
    story: 'Desenvolvemos uma camada descentralizada para liberação causal de conteúdo sob custódia criptográfica. Quando atingirmos a meta de 15 apoiadores, liberaremos o whitepaper completo e o código do smart-contract.',
    supportGoal: 15,
    supportCount: 12,
    publishedAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    realizedAt: null,
    createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    creator: {
      id: 'usr-seed-1',
      username: 'helenavoss',
      displayName: 'Dra. Helena Voss',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
    revealContent: null,
    viewerHasSupported: false,
  },
  {
    id: 'seed-intent-2',
    type: 'SUPPORT_REVEAL',
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    category: 'COMMUNITY_CAUSES',
    title: 'Horta Comunitária Urbana e Compostagem Solidária',
    story: 'Transformando o terreno baldio do bairro em um espaço agroecológico produtivo para 40 famílias. Ao atingirmos a meta, revelaremos o mapa oficial do projeto e o calendário de plantio.',
    supportGoal: 20,
    supportCount: 19,
    publishedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    realizedAt: null,
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    creator: {
      id: 'usr-seed-2',
      username: 'carlosmendez',
      displayName: 'Carlos Mendez',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    },
    revealContent: null,
    viewerHasSupported: false,
  },
  {
    id: 'seed-intent-3',
    type: 'SUPPORT_REVEAL',
    status: 'REALIZED',
    visibility: 'PUBLIC',
    category: 'EDUCATION',
    title: 'Curso Gratuito: Criptografia Aplicada na Prática',
    story: 'Meta de 10 apoiadores concluída com sucesso! Todo o material em PDF com exercícios guiados já está disponível.',
    supportGoal: 10,
    supportCount: 10,
    publishedAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    realizedAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    creator: {
      id: 'usr-seed-3',
      username: 'amandaribeiro',
      displayName: 'Dra. Amanda Ribeiro',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    },
    revealContent: '🎉 Link liberado: Acesse o repositório aberto com todos os módulos de SHA-256 e AES-256-GCM para Node.js e React em github.com/intent-os/crypto-course',
    viewerHasSupported: true,
  },
];

function getLocalIntents(): ApiIntent[] {
  try {
    const raw = localStorage.getItem(LOCAL_MVP_INTENTS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_MVP_INTENTS_KEY, JSON.stringify(DEFAULT_SEED_INTENTS));
      return DEFAULT_SEED_INTENTS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_SEED_INTENTS;
  }
}

function saveLocalIntents(intents: ApiIntent[]): void {
  try {
    localStorage.setItem(LOCAL_MVP_INTENTS_KEY, JSON.stringify(intents));
  } catch (e) {
    console.error('Falha ao salvar intents no localStorage:', e);
  }
}

function getLocalSupportedIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${LOCAL_MVP_SUPPORTS_KEY}_${userId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveLocalSupportedIds(userId: string, ids: Set<string>): void {
  try {
    localStorage.setItem(`${LOCAL_MVP_SUPPORTS_KEY}_${userId}`, JSON.stringify(Array.from(ids)));
  } catch (e) {
    console.error('Falha ao salvar suportes:', e);
  }
}

function getLocalFollowingIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${LOCAL_MVP_FOLLOWS_KEY}_${userId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set(['usr-seed-1', 'usr-seed-2']);
  } catch {
    return new Set(['usr-seed-1', 'usr-seed-2']);
  }
}

function saveLocalFollowingIds(userId: string, ids: Set<string>): void {
  try {
    localStorage.setItem(`${LOCAL_MVP_FOLLOWS_KEY}_${userId}`, JSON.stringify(Array.from(ids)));
  } catch (e) {
    console.error('Falha ao salvar seguidos:', e);
  }
}

export function mockCreateFallbackUserFromFirebase(firebaseUser: FirebaseUser): UserAccount {
  const cached = getCurrentSessionUser();
  const cleanEmail = (firebaseUser.email || 'usuario@intent.app').toLowerCase();
  const cleanName = firebaseUser.displayName || cached?.name || cleanEmail.split('@')[0] || 'Usuário Intent';
  const cleanUsername = cleanName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  const account = createDefaultUserFields({
    ...(cached?.id === firebaseUser.uid ? cached : {}),
    id: firebaseUser.uid,
    name: cleanName,
    username: cleanUsername,
    email: cleanEmail,
    avatarUrl: firebaseUser.photoURL || cached?.avatarUrl || undefined,
    bio: cached?.bio || 'Membro da rede Intent OS (Ambiente Preview/Mock).',
    status: 'active',
  });

  setCurrentSessionUser(account);
  return account;
}

export async function mockSyncAuthenticatedUser(firebaseUser: FirebaseUser | null = auth.currentUser): Promise<UserAccount> {
  if (!firebaseUser) {
    throw new IntentApiError('Usuário não autenticado no Firebase.', 401, 'AUTH_REQUIRED');
  }
  return mockCreateFallbackUserFromFirebase(firebaseUser);
}

export async function mockGetAuthenticatedProfile(): Promise<UserAccount> {
  const current = auth.currentUser;
  if (current) {
    return mockCreateFallbackUserFromFirebase(current);
  }
  const cached = getCurrentSessionUser();
  if (cached) return cached;
  throw new IntentApiError('Perfil não encontrado no modo mock.', 404, 'NOT_FOUND');
}

export async function mockGetSocialProfile(userId?: string): Promise<ApiSocialProfile> {
  const currentFbUser = auth.currentUser;
  const isMe = !userId || userId === currentFbUser?.uid;
  const targetId = userId || currentFbUser?.uid || 'usr-seed-1';

  const allIntents = getLocalIntents();
  const userIntents = allIntents.filter((i) => i.creator.id === targetId);
  const realizedCount = userIntents.filter((i) => i.status === 'REALIZED').length;
  const followingSet = currentFbUser ? getLocalFollowingIds(currentFbUser.uid) : new Set<string>();

  let name = 'Usuário Intent';
  let username = 'usuario';
  let avatarUrl: string | null = null;
  const bio: string | null = 'Membro ativo da rede Intent OS (Mock).';

  if (isMe && currentFbUser) {
    name = currentFbUser.displayName || 'Você';
    username = (currentFbUser.displayName || 'voce').toLowerCase().replace(/\s+/g, '_');
    avatarUrl = currentFbUser.photoURL || null;
  } else {
    const match = allIntents.find((i) => i.creator.id === targetId);
    if (match) {
      name = match.creator.displayName;
      username = match.creator.username;
      avatarUrl = match.creator.avatarUrl;
    }
  }

  return {
    id: targetId,
    username,
    displayName: name,
    bio,
    avatarUrl,
    createdAt: new Date().toISOString(),
    isMe,
    isFollowing: followingSet.has(targetId),
    stats: {
      intentsCreated: userIntents.length,
      intentsRealized: realizedCount,
      followersCount: isMe ? 4 : 12,
      followingCount: isMe ? followingSet.size : 8,
      supportsGiven: isMe ? 5 : 15,
      supportsReceived: userIntents.reduce((acc, i) => acc + i.supportCount, 0),
      realizationRate: userIntents.length > 0 ? Math.round((realizedCount / userIntents.length) * 100) : 0,
    },
    recentIntents: userIntents,
  };
}

export async function mockFollowProfile(userId: string): Promise<ApiSocialProfile> {
  const currentFbUser = auth.currentUser;
  if (currentFbUser) {
    const follows = getLocalFollowingIds(currentFbUser.uid);
    follows.add(userId);
    saveLocalFollowingIds(currentFbUser.uid, follows);
  }
  return mockGetSocialProfile(userId);
}

export async function mockUnfollowProfile(userId: string): Promise<ApiSocialProfile> {
  const currentFbUser = auth.currentUser;
  if (currentFbUser) {
    const follows = getLocalFollowingIds(currentFbUser.uid);
    follows.delete(userId);
    saveLocalFollowingIds(currentFbUser.uid, follows);
  }
  return mockGetSocialProfile(userId);
}

export async function mockListProfileConnections(
  _userId: string,
  _kind: 'followers' | 'following',
  _cursor?: string,
): Promise<{ items: ApiSocialConnection[]; nextCursor: string | null }> {
  const currentFbUser = auth.currentUser;
  const followingSet = currentFbUser ? getLocalFollowingIds(currentFbUser.uid) : new Set<string>();

  const connections: ApiSocialConnection[] = [
    {
      id: 'usr-seed-1',
      username: 'helenavoss',
      displayName: 'Dra. Helena Voss',
      bio: 'Pesquisadora em Criptografia e Redes Causalmente Determinísticas.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      followedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
      isMe: false,
      isFollowing: followingSet.has('usr-seed-1'),
    },
    {
      id: 'usr-seed-2',
      username: 'carlosmendez',
      displayName: 'Carlos Mendez',
      bio: 'Iniciativas de impacto social e projetos colaborativos.',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      followedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      isMe: false,
      isFollowing: followingSet.has('usr-seed-2'),
    },
  ];

  return { items: connections, nextCursor: null };
}

export async function mockCreateSupportIntent(input: CreateSupportIntentInput): Promise<ApiIntent> {
  const currentFbUser = auth.currentUser;
  const cachedUser = getCurrentSessionUser();
  const userId = currentFbUser?.uid || cachedUser?.id || 'usr-anon';
  const userName = currentFbUser?.displayName || cachedUser?.name || 'Você';
  const username = (cachedUser?.username || 'voce').replace(/^@+/, '');

  const newIntent: ApiIntent = {
    id: `intent-${Date.now()}`,
    type: 'SUPPORT_REVEAL',
    status: 'PUBLISHED',
    visibility: input.visibility,
    category: input.category,
    title: input.title,
    story: input.story,
    supportGoal: Number(input.supportGoal) || 1,
    supportCount: 0,
    publishedAt: new Date().toISOString(),
    realizedAt: null,
    createdAt: new Date().toISOString(),
    creator: {
      id: userId,
      username,
      displayName: userName,
      avatarUrl: currentFbUser?.photoURL || cachedUser?.avatarUrl || null,
    },
    revealContent: input.revealContent,
    viewerHasSupported: false,
  };

  const currentIntents = getLocalIntents();
  saveLocalIntents([newIntent, ...currentIntents]);
  return newIntent;
}

export async function mockListMyIntents(): Promise<{ items: ApiIntent[]; nextCursor: string | null }> {
  const currentFbUser = auth.currentUser;
  const cachedUser = getCurrentSessionUser();
  const userId = currentFbUser?.uid || cachedUser?.id;

  const allIntents = getLocalIntents();
  const myIntents = userId ? allIntents.filter((i) => i.creator.id === userId) : allIntents;

  const supportedSet = currentFbUser ? getLocalSupportedIds(currentFbUser.uid) : new Set<string>();
  const enriched = myIntents.map((i) => ({
    ...i,
    viewerHasSupported: supportedSet.has(i.id),
  }));

  return { items: enriched, nextCursor: null };
}

export async function mockListPublicIntents(
  scope: FeedScope = 'public',
  _cursor?: string,
): Promise<{ items: ApiIntent[]; nextCursor: string | null }> {
  const currentFbUser = auth.currentUser;
  const supportedSet = currentFbUser ? getLocalSupportedIds(currentFbUser.uid) : new Set<string>();
  const followingSet = currentFbUser ? getLocalFollowingIds(currentFbUser.uid) : new Set<string>();

  let all = getLocalIntents();
  if (scope === 'public') {
    all = all.filter((i) => i.visibility === 'PUBLIC');
  } else if (scope === 'following') {
    all = all.filter(
      (i) =>
        (i.visibility === 'PUBLIC' || i.visibility === 'FOLLOWERS') &&
        (followingSet.has(i.creator.id) || (currentFbUser && i.creator.id === currentFbUser.uid)),
    );
  }

  const items = all.map((i) => ({
    ...i,
    viewerHasSupported: supportedSet.has(i.id),
  }));

  return { items, nextCursor: null };
}

export async function mockGetIntent(intentId: string): Promise<ApiIntent> {
  const currentFbUser = auth.currentUser;
  const cachedUser = getCurrentSessionUser();
  const viewerId = currentFbUser?.uid || cachedUser?.id;
  const supportedSet = currentFbUser ? getLocalSupportedIds(currentFbUser.uid) : new Set<string>();
  const followingSet = currentFbUser ? getLocalFollowingIds(currentFbUser.uid) : new Set<string>();
  const all = getLocalIntents();
  const found = all.find((i) => i.id === intentId);
  if (!found) {
    throw new IntentApiError('Intent não encontrada.', 404, 'INTENT_NOT_FOUND');
  }

  if (found.visibility === 'PRIVATE' && found.creator.id !== viewerId) {
    throw new IntentApiError('Você não pode acessar esta Intent.', 403, 'INTENT_FORBIDDEN');
  }

  if (found.visibility === 'FOLLOWERS' && found.creator.id !== viewerId && !followingSet.has(found.creator.id)) {
    throw new IntentApiError('Esta Intent é visível somente para seguidores.', 403, 'INTENT_FORBIDDEN');
  }

  return {
    ...found,
    viewerHasSupported: supportedSet.has(found.id),
  };
}

export async function mockSupportIntent(intentId: string): Promise<SupportIntentResult> {
  const currentFbUser = auth.currentUser;
  const cachedUser = getCurrentSessionUser();
  const userId = currentFbUser?.uid || cachedUser?.id;

  const all = getLocalIntents();
  const index = all.findIndex((i) => i.id === intentId);
  if (index < 0) {
    throw new IntentApiError('Intent não encontrada.', 404, 'INTENT_NOT_FOUND');
  }

  const item = all[index];
  if (item.creator.id === userId) {
    throw new IntentApiError('O criador não pode apoiar a própria Intent.', 409, 'CREATOR_CANNOT_SUPPORT');
  }

  if (item.visibility === 'PRIVATE') {
    throw new IntentApiError('Você não pode apoiar uma Intent privada.', 403, 'INTENT_FORBIDDEN');
  }

  if (currentFbUser) {
    const supports = getLocalSupportedIds(currentFbUser.uid);
    supports.add(intentId);
    saveLocalSupportedIds(currentFbUser.uid, supports);
  }

  const newCount = item.supportCount + 1;
  const realized = newCount >= item.supportGoal;
  all[index] = {
    ...item,
    supportCount: newCount,
    status: realized ? 'REALIZED' : item.status,
    realizedAt: realized && !item.realizedAt ? new Date().toISOString() : item.realizedAt,
  };
  saveLocalIntents(all);
  return {
    intentId,
    supportCount: newCount,
    supportGoal: item.supportGoal,
    supported: true,
    realized,
    realizedNow: realized && item.status !== 'REALIZED',
  };
}

export async function mockRemoveIntentSupport(intentId: string): Promise<SupportIntentResult> {
  const currentFbUser = auth.currentUser;
  if (currentFbUser) {
    const supports = getLocalSupportedIds(currentFbUser.uid);
    supports.delete(intentId);
    saveLocalSupportedIds(currentFbUser.uid, supports);
  }

  const all = getLocalIntents();
  const index = all.findIndex((i) => i.id === intentId);
  if (index >= 0) {
    const item = all[index];
    const newCount = Math.max(0, item.supportCount - 1);
    const realized = newCount >= item.supportGoal;
    all[index] = {
      ...item,
      supportCount: newCount,
      status: realized ? 'REALIZED' : 'PUBLISHED',
    };
    saveLocalIntents(all);
    return {
      intentId,
      supportCount: newCount,
      supportGoal: item.supportGoal,
      supported: false,
      removed: true,
      realized,
      realizedNow: false,
    };
  }

  return {
    intentId,
    supportCount: 0,
    supportGoal: 10,
    supported: false,
    removed: true,
    realized: false,
    realizedNow: false,
  };
}
