import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { createDefaultUserFields, getCurrentSessionUser, setCurrentSessionUser } from '../utils/storage';
import type { UserAccount } from '../types';

const API_PREFIX = '/api';

interface ApiEnvelope<T> { data: T }
interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    fields?: {
      formErrors?: string[];
      fieldErrors?: Record<string, string[] | undefined>;
    };
  }
}

interface ApiUser {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserProfileInput {
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
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
  type: 'SUPPORT_REVEAL' | 'CONDITIONAL_REVEAL';
  conditionType: 'SUPPORT' | 'DATE' | 'GUARDIANS';
  status: 'PUBLISHED' | 'REALIZED';
  visibility: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
  category: IntentCategory;
  title: string;
  story: string;
  supportGoal: number;
  supportCount: number;
  revealAt: string | null;
  guardianIds?: string[];
  guardianApprovals?: string[];
  guardianApprovalGoal: number | null;
  guardianApprovalCount?: number;
  publishedAt: string;
  realizedAt: string | null;
  createdAt: string;
  creator: { id: string; username: string; displayName: string; avatarUrl: string | null };
  revealContent?: string | null;
  viewerHasSupported?: boolean;
  viewerIsGuardian?: boolean;
  viewerHasApprovedAsGuardian?: boolean;
  viewerSupported?: boolean;
  viewerWatching?: boolean;
  reactionCounts?: ReactionCounts;
  viewerReaction?: ReactionType | null;
  recentComments?: ApiIntentComment[];
}

export type ReactionType = 'LIKE' | 'LOVE' | 'CELEBRATE';

export interface ReactionCounts {
  LIKE: number;
  LOVE: number;
  CELEBRATE: number;
  total: number;
}

export interface IntentReactionResult {
  intentId: string;
  viewerReaction: ReactionType | null;
  reactionCounts: ReactionCounts;
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

export type NotificationType =
  | 'FOLLOW_RECEIVED'
  | 'SUPPORT_RECEIVED'
  | 'GUARDIAN_APPROVAL_RECEIVED'
  | 'INTENT_REACTION_RECEIVED'
  | 'INTENT_COMMENT_RECEIVED'
  | 'INTENT_REALIZED'
  | 'INTENT_WATCHED_REALIZED'
  | 'USER_FOLLOWED'
  | 'GUARDIAN_ACTION';

export interface ApiNotification {
  id: string;
  type: NotificationType;
  readAt: string | null;
  createdAt: string;
  actor: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  intent: { id: string; title: string } | null;
}

export type IntentHistoryEventType =
  | 'INTENT_CREATED'
  | 'SUPPORT_RECEIVED'
  | 'SUPPORT_REMOVED'
  | 'GUARDIAN_APPROVED'
  | 'INTENT_REALIZED';

export interface ApiIntentHistoryEvent {
  id: string;
  type: IntentHistoryEventType;
  occurredAt: string;
}

export interface ApiIntentComment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface ApiUserSearchResult {
  id: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl: string | null;
}

export interface ApiPersonalContactList {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  members: ApiUserSearchResult[];
}

export interface ApiSearchResults {
  intents: ApiIntent[];
  users: Array<ApiUserSearchResult & { bio: string | null }>;
  nextCursor: string | null;
}

export type SearchKind = 'all' | 'intents' | 'users';
export type SearchStatus = 'PUBLISHED' | 'REALIZED';
export type SearchPeriod = 'all' | 'week' | 'month';
export interface SearchOptions { kind?: SearchKind; status?: SearchStatus; period?: SearchPeriod; cursor?: string; limit?: number; }

export interface ApiIntentSupporter {
  id: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
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

export interface IntentWatchResult {
  intentId: string;
  watching: boolean;
}

export interface CreateSupportIntentInput {
  title: string;
  story: string;
  category: IntentCategory;
  conditionType: 'SUPPORT' | 'DATE' | 'GUARDIANS';
  supportGoal?: number;
  revealAt?: string;
  guardianIds?: string[];
  guardianApprovalGoal?: number;
  revealContent: string;
  visibility: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
  status?: 'DRAFT' | 'PUBLISHED';
}

export interface GuardianApprovalResult {
  intentId: string;
  approved: boolean;
  approvals: number;
  guardianApprovalGoal: number | null;
  realized: boolean;
  realizedNow: boolean;
}

export class IntentApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string, public readonly requestId?: string) {
    super(message);
    this.name = 'IntentApiError';
  }
}

function firstValidationMessage(payload: ApiErrorEnvelope) {
  const fieldErrors = payload.error?.fields?.fieldErrors;
  if (fieldErrors) {
    for (const messages of Object.values(fieldErrors)) {
      const message = messages?.find(Boolean);
      if (message) return message;
    }
  }
  return payload.error?.fields?.formErrors?.find(Boolean);
}

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
      firstValidationMessage(payload) || payload.error?.message || 'Não foi possível comunicar com o Intent.',
      response.status,
      payload.error?.code || 'API_ERROR',
      payload.error?.requestId,
    );
  }
  return response.json() as Promise<T>;
}

function mapApiUser(user: ApiUser, firebaseUser: FirebaseUser | null = auth.currentUser): UserAccount {
  const cached = getCurrentSessionUser();
  return createDefaultUserFields({
    ...(cached?.id === user.id ? cached : {}),
    id: user.id,
    name: user.displayName,
    username: user.username.replace(/^@+/, ''),
    email: firebaseUser?.email || (cached?.id === user.id ? cached.email : ''),
    avatarUrl: user.avatarUrl || undefined,
    bio: user.bio || undefined,
    createdAt: user.createdAt,
    status: 'active',
  });
}

export async function syncAuthenticatedUser(firebaseUser: FirebaseUser | null = auth.currentUser): Promise<UserAccount> {
  const result = await authenticatedRequest<ApiEnvelope<ApiUser>>('/v1/users/me/sync', { method: 'POST' }, firebaseUser);
  const account = mapApiUser(result.data, firebaseUser);
  setCurrentSessionUser(account);
  return account;
}

export async function getAuthenticatedProfile(): Promise<UserAccount> {
  const result = await authenticatedRequest<ApiEnvelope<ApiUser>>('/v1/users/me');
  const account = mapApiUser(result.data);
  setCurrentSessionUser(account);
  return account;
}

export async function updateUserProfile(input: UpdateUserProfileInput): Promise<UserAccount> {
  const result = await authenticatedRequest<ApiEnvelope<ApiUser>>('/v1/users/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  const account = mapApiUser(result.data);
  setCurrentSessionUser(account);
  return account;
}

export async function getSocialProfile(userId?: string): Promise<ApiSocialProfile> {
  const path = userId ? `/v1/users/${encodeURIComponent(userId)}/social` : '/v1/users/me/social';
  const result = await authenticatedRequest<ApiEnvelope<ApiSocialProfile>>(path);
  return result.data;
}

export async function followProfile(userId: string): Promise<ApiSocialProfile> {
  const result = await authenticatedRequest<ApiEnvelope<ApiSocialProfile>>(
    `/v1/users/${encodeURIComponent(userId)}/follow`,
    { method: 'POST' },
  );
  return result.data;
}

export async function unfollowProfile(userId: string): Promise<ApiSocialProfile> {
  const result = await authenticatedRequest<ApiEnvelope<ApiSocialProfile>>(
    `/v1/users/${encodeURIComponent(userId)}/follow`,
    { method: 'DELETE' },
  );
  return result.data;
}

export const followUser = followProfile;
export const unfollowUser = unfollowProfile;

export async function listNotifications(): Promise<ApiNotification[]> {
  const result = await authenticatedRequest<ApiEnvelope<{ items: ApiNotification[] }>>('/v1/notifications');
  return result.data.items;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const result = await authenticatedRequest<ApiEnvelope<{ unreadCount: number }>>(
    '/v1/notifications/unread-count',
  );
  return result.data.unreadCount;
}

export async function markNotificationRead(id: string): Promise<ApiNotification> {
  const result = await authenticatedRequest<ApiEnvelope<ApiNotification>>(
    `/v1/notifications/${encodeURIComponent(id)}/read`,
    { method: 'POST' },
  );
  return result.data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await authenticatedRequest<ApiEnvelope<{ success: boolean }>>(
    '/v1/notifications/read-all',
    { method: 'POST' },
  );
}

async function listProfileConnections(
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
  return listProfileConnections(userId, 'followers', cursor);
}

export function listProfileFollowing(userId: string, cursor?: string) {
  return listProfileConnections(userId, 'following', cursor);
}

export async function searchUsers(query: string): Promise<ApiUserSearchResult[]> {
  const search = new URLSearchParams({ q: query, limit: '10' });
  const result = await authenticatedRequest<ApiEnvelope<{ items: ApiUserSearchResult[] }>>(
    `/v1/users/search?${search.toString()}`,
  );
  return result.data.items;
}

export async function listPersonalContactLists(): Promise<ApiPersonalContactList[]> {
  const result = await authenticatedRequest<ApiEnvelope<{ items: ApiPersonalContactList[] }>>('/v1/personal-lists');
  return result.data.items;
}

export async function createPersonalContactList(name: string): Promise<ApiPersonalContactList> {
  const result = await authenticatedRequest<ApiEnvelope<ApiPersonalContactList>>('/v1/personal-lists', { method: 'POST', body: JSON.stringify({ name }) });
  return result.data;
}

export async function renamePersonalContactList(id: string, name: string): Promise<ApiPersonalContactList> {
  const result = await authenticatedRequest<ApiEnvelope<ApiPersonalContactList>>(`/v1/personal-lists/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name }) });
  return result.data;
}

export async function deletePersonalContactList(id: string): Promise<void> {
  await authenticatedRequest<ApiEnvelope<{ deleted: boolean }>>(`/v1/personal-lists/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function addPersonalContactListMember(listId: string, userId: string): Promise<ApiPersonalContactList> {
  const result = await authenticatedRequest<ApiEnvelope<ApiPersonalContactList>>(`/v1/personal-lists/${encodeURIComponent(listId)}/members`, { method: 'POST', body: JSON.stringify({ userId }) });
  return result.data;
}

export async function removePersonalContactListMember(listId: string, userId: string): Promise<ApiPersonalContactList> {
  const result = await authenticatedRequest<ApiEnvelope<ApiPersonalContactList>>(`/v1/personal-lists/${encodeURIComponent(listId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' });
  return result.data;
}

export async function searchIntentsAndUsers(query: string, options: SearchOptions = {}): Promise<ApiSearchResults> {
  const search = new URLSearchParams({ q: query, limit: String(options.limit ?? 10), kind: options.kind ?? 'all', period: options.period ?? 'all' });
  if (options.status) search.set('status', options.status);
  if (options.cursor) search.set('cursor', options.cursor);
  const result = await authenticatedRequest<ApiEnvelope<ApiSearchResults>>(
    `/v1/search?${search.toString()}`,
  );
  return result.data;
}

export async function createSupportIntent(input: CreateSupportIntentInput, idempotencyKey?: string): Promise<ApiIntent> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const result = await authenticatedRequest<ApiEnvelope<ApiIntent>>('/v1/intents', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  return result.data;
}

export async function publishIntent(intentId: string, idempotencyKey?: string): Promise<ApiIntent> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const result = await authenticatedRequest<ApiEnvelope<ApiIntent>>(
    `/v1/intents/${encodeURIComponent(intentId)}/publish`,
    {
      method: 'POST',
      headers,
    },
  );
  return result.data;
}

export async function listMyIntents(): Promise<{ items: ApiIntent[]; nextCursor: string | null }> {
  const result = await authenticatedRequest<ApiEnvelope<{ items: ApiIntent[]; nextCursor: string | null }>>('/v1/intents/mine');
  return result.data;
}

export async function listGuardianRequests(): Promise<{ items: ApiIntent[]; nextCursor: string | null }> {
  const result = await authenticatedRequest<ApiEnvelope<{ items: ApiIntent[]; nextCursor: string | null }>>('/v1/intents/guardian-requests');
  return result.data;
}

export type FeedScope = 'public' | 'following' | 'all';
export type SocialFeedFilter = 'recent' | 'realized' | 'supported' | 'mine' | 'popular';

export async function listPublicIntents(
  scope: FeedScope = 'public',
  cursor?: string,
): Promise<{ items: ApiIntent[]; nextCursor: string | null }> {
  const normalizedScope = scope === 'all' ? 'public' : scope;
  const query = new URLSearchParams({ scope: normalizedScope, limit: '20' });
  if (cursor) query.set('cursor', cursor);
  const result = await authenticatedRequest<ApiEnvelope<{ items: ApiIntent[]; nextCursor: string | null }>>(
    `/v1/intents/feed?${query.toString()}`,
  );
  return result.data;
}

export async function listSocialFeed(filter: SocialFeedFilter = 'recent', cursor?: string): Promise<{ items: ApiIntent[]; nextCursor: string | null }> {
  const query = new URLSearchParams({ filter, limit: '20' }); if (cursor) query.set('cursor', cursor);
  const result = await authenticatedRequest<ApiEnvelope<{ items: ApiIntent[]; nextCursor: string | null }>>(`/v1/intents/social-feed?${query.toString()}`);
  return result.data;
}

export async function getIntent(intentId: string): Promise<ApiIntent> {
  const result = await authenticatedRequest<ApiEnvelope<ApiIntent>>(`/v1/intents/${encodeURIComponent(intentId)}`);
  return result.data;
}

export async function listIntentHistory(intentId: string, cursor?: string): Promise<{ items: ApiIntentHistoryEvent[]; nextCursor: string | null }> {
  const query = new URLSearchParams({ limit: '20' });
  if (cursor) query.set('cursor', cursor);
  const result = await authenticatedRequest<ApiEnvelope<{ items: ApiIntentHistoryEvent[]; nextCursor: string | null }>>(
    `/v1/intents/${encodeURIComponent(intentId)}/history?${query.toString()}`,
  );
  return result.data;
}

export async function listIntentComments(intentId: string): Promise<ApiIntentComment[]> {
  const result = await authenticatedRequest<ApiEnvelope<{ items: ApiIntentComment[] }>>(
    `/v1/intents/${encodeURIComponent(intentId)}/comments`,
  );
  return result.data.items;
}

export async function createIntentComment(intentId: string, body: string): Promise<ApiIntentComment> {
  const result = await authenticatedRequest<ApiEnvelope<ApiIntentComment>>(
    `/v1/intents/${encodeURIComponent(intentId)}/comments`,
    { method: 'POST', body: JSON.stringify({ body }) },
  );
  return result.data;
}

export async function listIntentSupporters(intentId: string): Promise<ApiIntentSupporter[]> {
  const result = await authenticatedRequest<ApiEnvelope<{ items: ApiIntentSupporter[] }>>(
    `/v1/intents/${encodeURIComponent(intentId)}/supports`,
  );
  return result.data.items;
}

export async function supportIntent(intentId: string): Promise<SupportIntentResult> {
  const result = await authenticatedRequest<ApiEnvelope<SupportIntentResult>>(
    `/v1/intents/${encodeURIComponent(intentId)}/supports`,
    { method: 'POST' },
  );
  return result.data;
}

export async function removeIntentSupport(intentId: string): Promise<SupportIntentResult> {
  const result = await authenticatedRequest<ApiEnvelope<SupportIntentResult>>(
    `/v1/intents/${encodeURIComponent(intentId)}/supports`,
    { method: 'DELETE' },
  );
  return result.data;
}

export async function watchIntent(intentId: string): Promise<IntentWatchResult> {
  const result = await authenticatedRequest<ApiEnvelope<IntentWatchResult>>(
    `/v1/intents/${encodeURIComponent(intentId)}/watch`,
    { method: 'POST' },
  );
  return result.data;
}

export async function unwatchIntent(intentId: string): Promise<IntentWatchResult> {
  const result = await authenticatedRequest<ApiEnvelope<IntentWatchResult>>(
    `/v1/intents/${encodeURIComponent(intentId)}/watch`,
    { method: 'DELETE' },
  );
  return result.data;
}

export async function listWatchedIntents(cursor?: string): Promise<{ items: ApiIntent[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  const suffix = params.size ? `?${params.toString()}` : '';
  const result = await authenticatedRequest<ApiEnvelope<{ items: ApiIntent[]; nextCursor: string | null }>>(`/v1/intents/watched${suffix}`);
  return result.data;
}

export async function approveGuardianIntent(intentId: string): Promise<GuardianApprovalResult> {
  const result = await authenticatedRequest<ApiEnvelope<GuardianApprovalResult>>(
    `/v1/intents/${encodeURIComponent(intentId)}/guardian-approvals`,
    { method: 'POST' },
  );
  return result.data;
}

export async function setIntentReaction(intentId: string, type: ReactionType): Promise<IntentReactionResult> {
  const result = await authenticatedRequest<ApiEnvelope<IntentReactionResult>>(
    `/v1/intents/${encodeURIComponent(intentId)}/reactions`,
    { method: 'POST', body: JSON.stringify({ type }) },
  );
  return result.data;
}

export async function removeIntentReaction(intentId: string): Promise<IntentReactionResult> {
  const result = await authenticatedRequest<ApiEnvelope<IntentReactionResult>>(
    `/v1/intents/${encodeURIComponent(intentId)}/reactions`,
    { method: 'DELETE' },
  );
  return result.data;
}

export { authenticatedRequest };

export interface ApiPublicUserProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  isMe: boolean;
  viewerIsFollowing: boolean;
  stats: {
    intentsCreated: number;
    intentsRealized: number;
    totalSupportReceived: number;
    totalReactionsReceived: number;
    totalCommentsReceived: number;
    publicIntentsCount: number;
    followersCount: number;
    followingCount: number;
    supportedIntentsCount: number;
    reactionsGivenCount: number;
    commentsGivenCount: number;
    realizedParticipationsCount: number;
  };
  intents: Array<{ id: string; title: string; story: string; status: string;
    createdAt: string; supportCount: number }>;
}

export async function getPublicUserProfile(userId: string): Promise<ApiPublicUserProfile> {
  const result = await authenticatedRequest<ApiEnvelope<ApiPublicUserProfile>>(
    `/v1/users/${encodeURIComponent(userId)}/profile`,
  );
  return result.data;
}

export type ApiPublicActivityType =
  | 'INTENT_CREATED'
  | 'INTENT_SUPPORTED'
  | 'INTENT_REACTED'
  | 'INTENT_COMMENTED'
  | 'INTENT_REALIZED_PARTICIPATION';

export type PublicActivityFilter = 'ALL' | ApiPublicActivityType;

export interface ApiPublicActivityItem {
  id: string;
  type: ApiPublicActivityType;
  occurredAt: string;
  metadata?: {
    reactionType?: ReactionType;
    commentSnippet?: string;
    supportGoal?: number;
    supportCount?: number;
    realizedAt?: string | null;
  };
  intent: {
    id: string;
    title: string;
    status: string;
    category?: string;
    creator?: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  };
}

export interface ApiPublicActivityResponse {
  items: ApiPublicActivityItem[];
  nextCursor: string | null;
}

export async function listUserPublicActivity(
  userId: string,
  cursor?: string,
  limit = 20,
  type: PublicActivityFilter = 'ALL',
): Promise<ApiPublicActivityResponse> {
  const query = new URLSearchParams();
  if (cursor) query.set('cursor', cursor);
  if (limit) query.set('limit', String(limit));
  if (type && type !== 'ALL') query.set('type', type);
  const qs = query.toString();
  const url = `/v1/users/${encodeURIComponent(userId)}/activity${qs ? `?${qs}` : ''}`;
  const result = await authenticatedRequest<ApiEnvelope<ApiPublicActivityResponse>>(url);
  return result.data;
}
