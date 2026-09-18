import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors.js';
import { publicUserSelect, toPublicUser } from '../domain/public-user.js';

export type PublicActivityType =
  | 'INTENT_CREATED'
  | 'INTENT_SUPPORTED'
  | 'INTENT_REACTED'
  | 'INTENT_COMMENTED'
  | 'INTENT_REALIZED_PARTICIPATION';

export interface PublicActivityItem {
  id: string;
  type: PublicActivityType;
  occurredAt: string;
  metadata?: {
    reactionType?: 'LIKE' | 'LOVE' | 'CELEBRATE';
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

export type PublicActivityFilter =
  | 'ALL'
  | PublicActivityType;

export interface ListPublicActivityResult {
  items: PublicActivityItem[];
  nextCursor: string | null;
}

export function encodeActivityCursor(occurredAt: Date | string, id: string): string {
  const timeStr = typeof occurredAt === 'string' ? new Date(occurredAt).toISOString() : occurredAt.toISOString();
  return Buffer.from(`${timeStr}|${id}`).toString('base64url');
}

export function decodeActivityCursor(cursor: string): { occurredAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const [timeStr, id] = raw.split('|');
    if (!timeStr || !id) return null;
    const occurredAt = new Date(timeStr);
    if (isNaN(occurredAt.getTime())) return null;
    return { occurredAt, id };
  } catch {
    return null;
  }
}

export async function listUserPublicActivity(
  userId: string,
  cursorString?: string,
  limit = 20,
  filterType: PublicActivityFilter = 'ALL',
): Promise<ListPublicActivityResult> {
  const user = await prisma.user.findFirst({
    where: { id: userId, status: 'ACTIVE' },
    select: { id: true, status: true },
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Perfil não encontrado.');
  }

  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const parsedCursor = cursorString ? decodeActivityCursor(cursorString) : null;
  const cursorDate = parsedCursor?.occurredAt;

  // Escopo de visibilidade pública rigoroso:
  // Intent deve ser PUBLIC, status PUBLISHED ou REALIZED, e criador com status ACTIVE
  const publicIntentScope = {
    visibility: 'PUBLIC' as const,
    status: { in: ['PUBLISHED', 'REALIZED'] as ('PUBLISHED' | 'REALIZED')[] },
    creator: { status: 'ACTIVE' as const },
  };

  const shouldFetchIntents = filterType === 'ALL' || filterType === 'INTENT_CREATED';
  const shouldFetchSupports = filterType === 'ALL' || filterType === 'INTENT_SUPPORTED' || filterType === 'INTENT_REALIZED_PARTICIPATION';
  const shouldFetchReactions = filterType === 'ALL' || filterType === 'INTENT_REACTED';
  const shouldFetchComments = filterType === 'ALL' || filterType === 'INTENT_COMMENTED';

  // Buscar itens de cada fonte relevante com take: safeLimit + 1
  const [createdIntents, supports, reactions, comments] = await Promise.all([
    // 1. Intents criadas pelo usuário
    shouldFetchIntents
      ? prisma.intent.findMany({
          where: {
            creatorId: userId,
            ...publicIntentScope,
            ...(cursorDate ? { createdAt: { lte: cursorDate } } : {}),
          },
          take: safeLimit + 1,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            title: true,
            status: true,
            category: true,
            createdAt: true,
            publishedAt: true,
            realizedAt: true,
            supportGoal: true,
            supportCount: true,
            creator: { select: publicUserSelect },
          },
        })
      : Promise.resolve([]),

    // 2. Apoios dados pelo usuário
    shouldFetchSupports
      ? prisma.support.findMany({
          where: {
            userId,
            intent: {
              ...publicIntentScope,
              ...(filterType === 'INTENT_REALIZED_PARTICIPATION'
                ? { status: 'REALIZED' }
                : filterType === 'INTENT_SUPPORTED'
                  ? { status: 'PUBLISHED' }
                  : {}),
            },
            ...(cursorDate ? { createdAt: { lte: cursorDate } } : {}),
          },
          take: safeLimit + 1,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            createdAt: true,
            intent: {
              select: {
                id: true,
                title: true,
                status: true,
                category: true,
                realizedAt: true,
                supportGoal: true,
                supportCount: true,
                creator: { select: publicUserSelect },
              },
            },
          },
        })
      : Promise.resolve([]),

    // 3. Reações dadas pelo usuário
    shouldFetchReactions
      ? prisma.intentReaction.findMany({
          where: {
            userId,
            intent: publicIntentScope,
            ...(cursorDate ? { createdAt: { lte: cursorDate } } : {}),
          },
          take: safeLimit + 1,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            type: true,
            createdAt: true,
            intent: {
              select: {
                id: true,
                title: true,
                status: true,
                category: true,
                realizedAt: true,
                creator: { select: publicUserSelect },
              },
            },
          },
        })
      : Promise.resolve([]),

    // 4. Comentários feitos pelo usuário
    shouldFetchComments
      ? prisma.intentComment.findMany({
          where: {
            authorId: userId,
            intent: publicIntentScope,
            ...(cursorDate ? { createdAt: { lte: cursorDate } } : {}),
          },
          take: safeLimit + 1,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            body: true,
            createdAt: true,
            intent: {
              select: {
                id: true,
                title: true,
                status: true,
                category: true,
                realizedAt: true,
                creator: { select: publicUserSelect },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const rawEvents: PublicActivityItem[] = [];

  // Mapear Intents criadas
  if (shouldFetchIntents) {
    for (const intent of createdIntents) {
      if (filterType !== 'ALL' && filterType !== 'INTENT_CREATED') continue;
      const rawId = `intent_created:${intent.id}`;
      const occurredAt = (intent.publishedAt || intent.createdAt).toISOString();
      rawEvents.push({
        id: rawId,
        type: 'INTENT_CREATED',
        occurredAt,
        metadata: {
          supportGoal: intent.supportGoal,
          supportCount: intent.supportCount,
          realizedAt: intent.realizedAt ? intent.realizedAt.toISOString() : null,
        },
        intent: {
          id: intent.id,
          title: intent.title,
          status: intent.status,
          category: intent.category,
          creator: toPublicUser(intent.creator),
        },
      });
    }
  }

  // Mapear Apoios e Participações em Realizações
  if (shouldFetchSupports) {
    for (const support of supports) {
      const isRealized = support.intent.status === 'REALIZED';
      const type: PublicActivityType = isRealized
        ? 'INTENT_REALIZED_PARTICIPATION'
        : 'INTENT_SUPPORTED';

      if (filterType !== 'ALL' && filterType !== type) continue;

      const rawId = isRealized
        ? `intent_realized_participation:${support.id}`
        : `intent_supported:${support.id}`;
      const occurredAt = support.createdAt.toISOString();

      rawEvents.push({
        id: rawId,
        type,
        occurredAt,
        metadata: {
          supportGoal: support.intent.supportGoal,
          supportCount: support.intent.supportCount,
          realizedAt: support.intent.realizedAt ? support.intent.realizedAt.toISOString() : null,
        },
        intent: {
          id: support.intent.id,
          title: support.intent.title,
          status: support.intent.status,
          category: support.intent.category,
          creator: toPublicUser(support.intent.creator),
        },
      });
    }
  }

  // Mapear Reações
  if (shouldFetchReactions) {
    for (const reaction of reactions) {
      if (filterType !== 'ALL' && filterType !== 'INTENT_REACTED') continue;
      const rawId = `intent_reacted:${reaction.id}`;
      const occurredAt = reaction.createdAt.toISOString();
      rawEvents.push({
        id: rawId,
        type: 'INTENT_REACTED',
        occurredAt,
        metadata: {
          reactionType: reaction.type,
        },
        intent: {
          id: reaction.intent.id,
          title: reaction.intent.title,
          status: reaction.intent.status,
          category: reaction.intent.category,
          creator: toPublicUser(reaction.intent.creator),
        },
      });
    }
  }

  // Mapear Comentários
  if (shouldFetchComments) {
    for (const comment of comments) {
      if (filterType !== 'ALL' && filterType !== 'INTENT_COMMENTED') continue;
      const rawId = `intent_commented:${comment.id}`;
      const occurredAt = comment.createdAt.toISOString();
      // Trecho seguro e truncado do comentário (máximo 120 caracteres)
      const snippet = comment.body.length > 120 ? `${comment.body.slice(0, 117)}...` : comment.body;
      rawEvents.push({
        id: rawId,
        type: 'INTENT_COMMENTED',
        occurredAt,
        metadata: {
          commentSnippet: snippet,
        },
        intent: {
          id: comment.intent.id,
          title: comment.intent.title,
          status: comment.intent.status,
          category: comment.intent.category,
          creator: toPublicUser(comment.intent.creator),
        },
      });
    }
  }

  // Ordenação global cronológica: occurredAt DESC, id DESC
  rawEvents.sort((a, b) => {
    const timeDiff = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  });

  // Se houver cursor, filtrar para garantir que itens antes ou iguais ao cursor já vistos sejam excluídos
  let filteredEvents = rawEvents;
  if (parsedCursor) {
    const cursorTime = parsedCursor.occurredAt.getTime();
    filteredEvents = rawEvents.filter((item) => {
      const itemTime = new Date(item.occurredAt).getTime();
      if (itemTime < cursorTime) return true;
      if (itemTime === cursorTime) {
        return item.id.localeCompare(parsedCursor.id) < 0;
      }
      return false;
    });
  }

  const items = filteredEvents.slice(0, safeLimit);
  const hasMore = filteredEvents.length > safeLimit;

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    nextCursor = encodeActivityCursor(lastItem.occurredAt, lastItem.id);
  }

  return {
    items,
    nextCursor,
  };
}
