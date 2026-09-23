import type { NotificationType, Prisma } from '@prisma/client';
import { AppError } from '../errors.js';
import { prisma } from '../lib/prisma.js';

type NotificationClient = Pick<Prisma.TransactionClient, 'notification' | 'intentWatch'>;

export const notificationSelect = {
  id: true,
  type: true,
  readAt: true,
  createdAt: true,
  actor: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  },
  intent: {
    select: {
      id: true,
      title: true,
    },
  },
} satisfies Prisma.NotificationSelect;

type NotificationProjection = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;

function toPublicNotification(notification: NotificationProjection) {
  return {
    id: notification.id,
    type: notification.type,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
    actor: {
      id: notification.actor.id,
      username: notification.actor.username,
      displayName: notification.actor.displayName,
      avatarUrl: notification.actor.avatarUrl,
    },
    intent: notification.intent ? {
      id: notification.intent.id,
      title: notification.intent.title,
    } : null,
  };
}

interface CreateNotificationInput {
  userId: string;
  actorId: string;
  type: NotificationType;
  intentId?: string;
  deduplicationKey: string;
}

interface IntentRealizationNotificationInput {
  intentId: string;
  actorId: string;
  creatorId: string;
  visibility: string;
  guardianIds: Prisma.JsonValue | unknown;
}

function guardianIds(value: Prisma.JsonValue | unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export async function createNotification(
  transaction: Prisma.TransactionClient,
  input: CreateNotificationInput,
): Promise<void> {
  if (input.userId === input.actorId) return;

  await transaction.notification.createMany({
    data: [{
      userId: input.userId,
      actorId: input.actorId,
      type: input.type,
      intentId: input.intentId ?? null,
      deduplicationKey: input.deduplicationKey,
    }],
    skipDuplicates: true,
  });
}

/**
 * Emits one notification per eligible watcher for the state transition that
 * actually realized an Intent. The unique deduplication key makes retries and
 * concurrent transitions safe without turning watches into a second domain
 * counter.
 */
export async function notifyIntentWatchersOfRealization(
  transaction: NotificationClient,
  input: IntentRealizationNotificationInput,
): Promise<void> {
  const excludedUserIds = [input.actorId, input.creatorId];
  const visibilityWhere: Prisma.IntentWatchWhereInput = input.visibility === 'FOLLOWERS'
    ? { user: { following: { some: { followingId: input.creatorId } } } }
    : input.visibility === 'PRIVATE'
      ? { userId: { in: guardianIds(input.guardianIds) } }
      : {};

  const watchers = await transaction.intentWatch.findMany({
    where: {
      intentId: input.intentId,
      userId: { notIn: excludedUserIds },
      user: { status: 'ACTIVE' },
      ...visibilityWhere,
    },
    select: { userId: true },
  });

  if (watchers.length === 0) return;
  await transaction.notification.createMany({
    data: watchers.map(({ userId }) => ({
      userId,
      actorId: input.actorId,
      type: 'INTENT_WATCHED_REALIZED' as NotificationType,
      intentId: input.intentId,
      deduplicationKey: `intent-watch-realized:${input.intentId}:${userId}`,
    })),
    skipDuplicates: true,
  });
}

export async function listNotifications(userId: string, limit = 50) {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: Math.min(Math.max(limit, 1), 50),
    select: notificationSelect,
  });
  const intentIds = notifications.flatMap((notification) => notification.intent ? [notification.intent.id] : []);
  const accessibleIntentIds = intentIds.length === 0 ? new Set<string>() : new Set((await prisma.intent.findMany({
    where: {
      id: { in: intentIds },
      status: { in: ['PUBLISHED', 'REALIZED', 'CANCELLED'] },
      OR: [
        { creatorId: userId },
        { AND: [{ creator: { status: 'ACTIVE' } }, { visibility: 'PUBLIC' }] },
        { AND: [{ creator: { status: 'ACTIVE' } }, { visibility: 'FOLLOWERS' }, { creator: { followers: { some: { followerId: userId } } } }] },
        { AND: [{ creator: { status: 'ACTIVE' } }, { visibility: 'PRIVATE' }, { guardianIds: { array_contains: [userId] } }] },
      ],
    },
    select: { id: true },
  })).map(({ id }) => id));

  return notifications.map((notification) => toPublicNotification(
    notification.intent && !accessibleIntentIds.has(notification.intent.id)
      ? { ...notification, intent: null }
      : notification,
  ));
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  return prisma.$transaction(async (transaction) => {
    await transaction.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });

    const notification = await transaction.notification.findFirst({
      where: { id: notificationId, userId },
      select: notificationSelect,
    });
    if (!notification) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notificação não encontrada.');
    }
    return toPublicNotification(notification);
  });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { success: true };
}
