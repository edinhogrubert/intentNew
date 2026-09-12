import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { createDefaultUserFields, getCurrentSessionUser, setCurrentSessionUser } from '../utils/storage';
import type { UserAccount } from '../types';
import * as mockApi from './mockIntentApi';

const API_PREFIX = '/api';

/**
 * Flag explícita de ambiente (conforme orientação de arquitetura limpa):
 * - VITE_USE_MOCKS === 'true': ativa mocks isolados apenas para preview / testes de interface sem subir PostgreSQL.
 * - VITE_USE_MOCKS !== 'true' (padrão): se conecta diretamente à API real (PostgreSQL + Express).
 *   Se o backend falhar, o erro real é exibido sem mascaramento.
 */
export const IS_MOCK_MODE = import.meta.env.VITE_USE_MOCKS === 'true';

interface ApiEnvelope<T> { data: T }
interface ApiErrorEnvelope { error?: { code?: string; message?: string; requestId?: string } }

interface ApiUser {
  id: string;
  firebaseUid: string;
  email: string | null;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export type IntentCategory =
  | 'SPORTS'
  | 'ENTERTAINMENT'
  | 'TECHNOLOGY'
  | 'EDUCATION'
  | 'HEALTH_WELLNESS'
  | 'CAREER_BUSINESS'
  | 'COMMUNITY_CAUSES'
  | 'PERSONAL_LIFE'
  | 'OTHER';

export interface ApiIntent {
  id: string;
  type: 'SUPPORT_REVEAL';
  status: 'PUBLISHED' | 'REALIZED';
  visibility: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
  category: IntentCategory;
  title: string;
  story: string;
  supportGoal: number;
  supportCount: number;
  publishedAt: string;
  realizedAt: string | null;
  createdAt: string;
  creator: { id: string; username: string; displayName: string; avatarUrl: string | null };
  revealContent?: string | null;
  viewerHasSupported?: boolean;
}

export interface ApiSocialProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  isMe: boolean;
  isFollowing: boolean;
  stats: {
    intentsCreated: number;
    intentsRealized: number;
    followersCount: number;
    followingCount: number;
    supportsGiven: number;
    supportsReceived: number;
    realizationRate: number;
  };
  recentIntents: ApiIntent[];
}

export interface ApiSocialConnection {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  followedAt: string;
  isMe: boolean;
  isFollowing: boolean;
}

export interface SupportIntentResult {
  intentId: string;
  supportCount: number;
  supportGoal: number;
  supported: boolean;
  removed?: boolean;
  realized: boolean;
  realizedNow: boolean;
}

export interface CreateSupportIntentInput {
  title: string;
  story: string;
  category: IntentCategory;
  supportGoal: number;
  revealContent: string;
  visibility: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
}

export class IntentApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string, public readonly requestId?: string) {
    super(message);
    this.name = 'IntentApiError';
  }
}

// ---------------------------------------------------------------------------
// Cliente HTTP Real (Produção / Local com PostgreSQL)
// NENHUM fallback silencioso: se o backend falhar, o erro é repassado estritamente.
// ---------------------------------------------------------------------------
async function authenticatedRequest<T>(path: string, init: RequestInit = {}, firebaseUser: FirebaseUser | null = auth.currentUser): Promise<T> {
  if (!firebaseUser) throw new IntentApiError('Entre na sua conta para continuar.', 401, 'AUTH_REQUIRED');

  const token = await firebaseUser.getIdToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_PREFIX}${path}`, { ...init, headers });
  if (!response.ok) {
    let payload: ApiErrorEnvelope = {};
    try { payload = await response.json() as ApiErrorEnvelope; } catch { /* resposta não JSON */ }
    throw new IntentApiError(
      payload.error?.message || `Erro na comunicação com a API (HTTP ${response.status}).`,
      response.status,
      payload.error?.code || 'API_ERROR',
      payload.error?.requestId,
    );
  }
  return response.json() as Promise<T>;
}

function mapApiUser(user: ApiUser): UserAccount {
  const cached = getCurrentSessionUser();
  const status: UserAccount['status'] = user.status === 'SUSPENDED' ? 'suspended' : user.status === 'INACTIVE' ? 'inactive' : 'active';
  return createDefaultUserFields({
    ...(cached?.id === user.id ? cached : {}),
    id: user.id,
    name: user.displayName,
    username: user.username.replace(/^@+/, ''),
    email: user.email || '',
    avatarUrl: user.avatarUrl || undefined,
    bio: user.bio || undefined,
    createdAt: user.createdAt,
    status,
  });
}

// ---------------------------------------------------------------------------
// Métodos da API com chaveamento explícito por Flag de Ambiente
// ---------------------------------------------------------------------------

export async function syncAuthenticatedUser(firebaseUser: FirebaseUser | null = auth.currentUser): Promise<UserAccount> {
  if (IS_MOCK_MODE) {
    return mockApi.mockSyncAuthenticatedUser(firebaseUser);
  }
  const result = await authenticatedRequest<ApiEnvelope<ApiUser>>('/v1/users/me/sync', { method: 'POST' }, firebaseUser);
  const account = mapApiUser(result.data);
  setCurrentSessionUser(account);
  return account;
}

export async function getAuthenticatedProfile(): Promise<UserAccount> {
  if (IS_MOCK_MODE) {
    return mockApi.mockGetAuthenticatedProfile();
  }
  const result = await authenticatedRequest<ApiEnvelope<ApiUser>>('/v1/users/me');
  const account = mapApiUser(result.data);
  setCurrentSessionUser(account);
  return account;
}

export async function getSocialProfile(userId?: string): Promise<ApiSocialProfile> {
  if (IS_MOCK_MODE) {
    return mockApi.mockGetSocialProfile(userId);
  }
  const path = userId ? `/v1/users/${encodeURIComponent(userId)}/social` : '/v1/users/me/social';
  const result = await authenticatedRequest<ApiEnvelope<ApiSocialProfile>>(path);
  return result.data;
}

export async function followProfile(userId: string): Promise<ApiSocialProfile> {
  if (IS_MOCK_MODE) {
    return mockApi.mockFollowProfile(userId);
  }
  const result = await authenticatedRequest<ApiEnvelope<ApiSocialProfile>>(
    `/v1/users/${encodeURIComponent(userId)}/follow`,
    { method: 'POST' },
  );
  return result.data;
}

export async function unfollowProfile(userId: string): Promise<ApiSocialProfile> {
  if (IS_MOCK_MODE) {
    return mockApi.mockUnfollowProfile(userId);
  }
  const result = await authenticatedRequest<ApiEnvelope<ApiSocialProfile>>(
    `/v1/users/${encodeURIComponent(userId)}/follow`,
    { method: 'DELETE' },
  );
  return result.data;
}

async function listRealProfileConnections(
  userId: string,
  kind: 'followers' | 'following',
  cursor?: string,
): Promise<{ items: ApiSocialConnection[]; nextCursor: string | null }> {
  const query = new URLSearchParams({ limit: '20' });
  if (cursor) query.set('cursor', cursor);
  const result = await authenticatedRequest<ApiEnvelope<{ items: ApiSocialConnection[]; nextCursor: string | null }>>(
    `/v1/users/${encodeURIComponent(userId)}/${kind}?${query.toString()}`,
  );
  return result.data;
}

export function listProfileFollowers(userId: string, cursor?: string) {
  if (IS_MOCK_MODE) {
    return mockApi.mockListProfileConnections(userId, 'followers', cursor);
  }
  return listRealProfileConnections(userId, 'followers', cursor);
}

export function listProfileFollowing(userId: string, cursor?: string) {
  if (IS_MOCK_MODE) {
    return mockApi.mockListProfileConnections(userId, 'following', cursor);
  }
  return listRealProfileConnections(userId, 'following', cursor);
}

export async function createSupportIntent(input: CreateSupportIntentInput, idempotencyKey?: string): Promise<ApiIntent> {
  if (IS_MOCK_MODE) {
    return mockApi.mockCreateSupportIntent(input);
  }
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const result = await authenticatedRequest<ApiEnvelope<ApiIntent>>('/v1/intents', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  return result.data;
}

export async function listMyIntents(): Promise<{ items: ApiIntent[]; nextCursor: string | null }> {
  if (IS_MOCK_MODE) {
    return mockApi.mockListMyIntents();
  }
  const result = await authenticatedRequest<ApiEnvelope<{ items: ApiIntent[]; nextCursor: string | null }>>('/v1/intents/mine');
  return result.data;
}

export type FeedScope = 'public' | 'following';

export async function listPublicIntents(
  scope: FeedScope = 'public',
  cursor?: string,
): Promise<{ items: ApiIntent[]; nextCursor: string | null }> {
  if (IS_MOCK_MODE) {
    return mockApi.mockListPublicIntents(scope, cursor);
  }
  const query = new URLSearchParams({ scope, limit: '20' });
  if (cursor) query.set('cursor', cursor);
  const result = await authenticatedRequest<ApiEnvelope<{ items: ApiIntent[]; nextCursor: string | null }>>(
    `/v1/intents/feed?${query.toString()}`,
  );
  return result.data;
}

export async function getIntent(intentId: string): Promise<ApiIntent> {
  if (IS_MOCK_MODE) {
    return mockApi.mockGetIntent(intentId);
  }
  const result = await authenticatedRequest<ApiEnvelope<ApiIntent>>(`/v1/intents/${encodeURIComponent(intentId)}`);
  return result.data;
}

export async function supportIntent(intentId: string, idempotencyKey?: string): Promise<SupportIntentResult> {
  if (IS_MOCK_MODE) {
    return mockApi.mockSupportIntent(intentId);
  }
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const result = await authenticatedRequest<ApiEnvelope<SupportIntentResult>>(
    `/v1/intents/${encodeURIComponent(intentId)}/supports`,
    { method: 'POST', headers },
  );
  return result.data;
}

export async function removeIntentSupport(intentId: string, idempotencyKey?: string): Promise<SupportIntentResult> {
  if (IS_MOCK_MODE) {
    return mockApi.mockRemoveIntentSupport(intentId);
  }
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const result = await authenticatedRequest<ApiEnvelope<SupportIntentResult>>(
    `/v1/intents/${encodeURIComponent(intentId)}/supports`,
    { method: 'DELETE', headers },
  );
  return result.data;
}

export { authenticatedRequest };
