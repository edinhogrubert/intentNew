import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireIntentViewAccess } from './intent-service.js';

const watchedIntentSelection = {
  id: true,
  type: true,
  conditionType: true,
  status: true,
  visibility: true,
  category: true,
  title: true,
  story: true,
  supportGoal: true,
  supportCount: true,
  revealAt: true,
  guardianApprovalGoal: true,
  publishedAt: true,
  realizedAt: true,
  createdAt: true,
  creator: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
} satisfies Prisma.IntentSelect;

function visibleIntentWhere(viewerId: string): Prisma.IntentWhereInput {
  return {
    creator: { status: 'ACTIVE' },
    status: { in: ['PUBLISHED', 'REALIZED'] },
    OR: [
      { visibility: 'PUBLIC' },
      { creatorId: viewerId },
      { visibility: 'FOLLOWERS', creator: { followers: { some: { followerId: viewerId } } } },
      { visibility: 'PRIVATE', guardianIds: { array_contains: [viewerId] } },
    ],
  };
}

export async function watchIntent(intentId: string, viewerId: string) {
  await requireIntentViewAccess(intentId, viewerId);
  await prisma.intentWatch.upsert({
    where: { intentId_userId: { intentId, userId: viewerId } },
    create: { intentId, userId: viewerId },
    update: {},
  });
  return { intentId, watching: true };
}

/** Removing a personal watch is idempotent and does not reveal whether the Intent remains visible. */
export async function unwatchIntent(intentId: string, viewerId: string) {
  await prisma.intentWatch.deleteMany({ where: { intentId, userId: viewerId } });
  return { intentId, watching: false };
}

export async function listWatchedIntents(viewerId: string, cursor?: string, limit = 20) {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const rows = await prisma.intentWatch.findMany({
    where: { userId: viewerId, intent: visibleIntentWhere(viewerId) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: safeLimit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, intent: { select: watchedIntentSelection } },
  });
  const page = rows.slice(0, safeLimit);
  return {
    items: page.map(({ intent }) => ({ ...intent, viewerWatching: true })),
    nextCursor: rows.length > safeLimit ? page.at(-1)?.id ?? null : null,
  };
}

