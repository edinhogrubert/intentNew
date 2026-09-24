import { Prisma } from '@prisma/client';
import { AppError } from '../errors.js';
import { prisma } from '../lib/prisma.js';
import { requireIntentViewAccess } from './intent-service.js';
import { createNotification } from './notification-service.js';
import type { ReactionType } from '../domain/reaction-schemas.js';

export interface ReactionCounts {
  LIKE: number;
  LOVE: number;
  CELEBRATE: number;
  total: number;
}

export interface IntentReactionSummary {
  intentId: string;
  viewerReaction: ReactionType | null;
  reactionCounts: ReactionCounts;
}

export async function getIntentReactionSummary(
  intentId: string,
  viewerId?: string,
  client: Pick<Prisma.TransactionClient, 'intentReaction'> = prisma,
): Promise<{ reactionCounts: ReactionCounts; viewerReaction: ReactionType | null }> {
  const reactionCounts: ReactionCounts = {
    LIKE: 0,
    LOVE: 0,
    CELEBRATE: 0,
    total: 0,
  };

  if (!client?.intentReaction?.groupBy) {
    return { reactionCounts, viewerReaction: null };
  }

  const grouped = await client.intentReaction.groupBy({
    by: ['type'],
    where: { intentId },
    _count: { _all: true },
  });

  if (Array.isArray(grouped)) {
    for (const group of grouped) {
      if (group.type === 'LIKE') reactionCounts.LIKE = group._count._all;
      if (group.type === 'LOVE') reactionCounts.LOVE = group._count._all;
      if (group.type === 'CELEBRATE') reactionCounts.CELEBRATE = group._count._all;
    }
  }
  reactionCounts.total = reactionCounts.LIKE + reactionCounts.LOVE + reactionCounts.CELEBRATE;

  let viewerReaction: ReactionType | null = null;
  if (viewerId && client.intentReaction.findUnique) {
    const existing = await client.intentReaction.findUnique({
      where: { intentId_userId: { intentId, userId: viewerId } },
      select: { type: true },
    });
    viewerReaction = (existing?.type as ReactionType) ?? null;
  }

  return { reactionCounts, viewerReaction };
}

export async function setIntentReaction(
  intentId: string,
  userId: string,
  type: ReactionType,
): Promise<IntentReactionSummary> {
  await requireIntentViewAccess(intentId, userId);

  const target = await prisma.intent.findUnique({
    where: { id: intentId },
    select: { status: true },
  });
  if (target?.status === 'DRAFT') {
    throw new AppError(400, 'INTENT_NOT_PUBLISHED', 'Não é possível reagir a uma Intent em rascunho.');
  }

  await prisma.intentReaction.upsert({
    where: { intentId_userId: { intentId, userId } },
    create: {
      intentId,
      userId,
      type,
    },
    update: {
      type,
    },
  });

  const intent = await prisma.intent.findUnique({
    where: { id: intentId },
    select: { creatorId: true },
  });
  if (intent && intent.creatorId !== userId) {
    await createNotification(prisma, {
      userId: intent.creatorId,
      actorId: userId,
      type: 'INTENT_REACTION_RECEIVED',
      intentId,
      deduplicationKey: `reaction:${intentId}:${userId}`,
    });
  }

  const summary = await getIntentReactionSummary(intentId, userId);
  return {
    intentId,
    viewerReaction: summary.viewerReaction,
    reactionCounts: summary.reactionCounts,
  };
}

export async function removeIntentReaction(
  intentId: string,
  userId: string,
): Promise<IntentReactionSummary> {
  await requireIntentViewAccess(intentId, userId);

  await prisma.intentReaction.deleteMany({
    where: {
      intentId,
      userId,
    },
  });

  const summary = await getIntentReactionSummary(intentId, userId);
  return {
    intentId,
    viewerReaction: null,
    reactionCounts: summary.reactionCounts,
  };
}
