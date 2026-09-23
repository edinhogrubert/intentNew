import { prisma } from '../lib/prisma.js';
import { requireIntentViewAccess } from './intent-service.js';

export interface HistoryEventItem {
  id: string;
  type: string;
  occurredAt: string;
}

export async function listIntentHistory(
  intentId: string,
  viewerId: string,
  cursor?: string,
  limit = 20,
): Promise<{ items: HistoryEventItem[]; nextCursor: string | null }> {
  await requireIntentViewAccess(intentId, viewerId);

  const take = Math.min(Math.max(limit, 1), 50);

  const events = await prisma.domainEvent.findMany({
    where: { intentId },
    orderBy: [
      { occurredAt: 'desc' },
      { id: 'desc' },
    ],
    take: take + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
    select: {
      id: true,
      type: true,
      occurredAt: true,
    },
  });

  const hasMore = events.length > take;
  const items = (hasMore ? events.slice(0, take) : events).map((event) => ({
    id: event.id,
    type: event.type,
    occurredAt: event.occurredAt.toISOString(),
  }));

  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  return {
    items,
    nextCursor,
  };
}
