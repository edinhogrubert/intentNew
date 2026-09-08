import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { prisma } from '../lib/prisma.js';
import { openReveal, revealAssociatedData, sealReveal } from '../domain/reveal-crypto.js';
import { isSupportConditionSatisfied } from '../domain/support-condition.js';
import { createIntentSchema } from '../domain/intent-schemas.js';

const publicIntentSelection = {
  id: true,
  type: true,
  status: true,
  visibility: true,
  category: true,
  title: true,
  story: true,
  supportGoal: true,
  supportCount: true,
  publishedAt: true,
  realizedAt: true,
  createdAt: true,
  creator: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  },
} as Prisma.IntentSelect;

async function requireActiveActor(transaction: Prisma.TransactionClient, actorId: string) {
  const actor = await transaction.user.findUnique({
    where: { id: actorId },
    select: { status: true },
  });
  if (!actor || actor.status !== 'ACTIVE') {
    throw new AppError(403, 'ACCOUNT_INACTIVE', 'Esta conta não está ativa.');
  }
}

function assertPublishedState(intent: { supportCount: number; supportGoal: number; realizedAt: Date | null }) {
  if (!Number.isInteger(intent.supportCount) || intent.supportCount < 0
    || !Number.isInteger(intent.supportGoal) || intent.supportGoal < 1
    || intent.supportCount >= intent.supportGoal || intent.realizedAt != null) {
    throw new AppError(409, 'INTENT_STATE_INVALID', 'O estado da Intent é inconsistente.');
  }
}

// Actor IDs come from the authenticated server context, never from command fields.
export async function createIntent(creatorId: string, input: unknown) {
  const command = createIntentSchema.parse(input);
  const intentId = randomUUID();
  const revealVersion = 1;
  const sealed = sealReveal(
    command.revealContent,
    config.revealEncryptionKey,
    revealAssociatedData(intentId, revealVersion),
  );

  return prisma.$transaction(async (transaction) => {
    await requireActiveActor(transaction, creatorId);
    const intent = await transaction.intent.create({
      data: {
        id: intentId,
        creatorId,
        type: 'SUPPORT_REVEAL',
        status: 'PUBLISHED',
        supportCount: 0,
        realizedAt: null,
        title: command.title,
        story: command.story,
        category: command.category,
        supportGoal: command.supportGoal,
        visibility: command.visibility,
        revealCiphertext: sealed.ciphertext,
        revealIv: sealed.iv,
        revealAuthTag: sealed.authTag,
        revealVersion,
      } as Prisma.IntentUncheckedCreateInput,
      select: publicIntentSelection,
    });

    await transaction.domainEvent.create({
      data: {
        intentId,
        actorId: creatorId,
        type: 'INTENT_CREATED',
        idempotencyKey: `intent-created:${intentId}:v1`,
        payload: {
          type: 'SUPPORT_REVEAL',
          supportGoal: command.supportGoal,
          category: command.category,
          visibility: command.visibility,
          revealVersion,
        },
      },
    });

    return intent;
  });
}

export async function listUserIntents(creatorId: string, cursor?: string, limit = 20) {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const items = await prisma.intent.findMany({
    where: { creatorId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: safeLimit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: publicIntentSelection,
  });

  const hasMore = items.length > safeLimit;
  const page = hasMore ? items.slice(0, safeLimit) : items;

  return {
    items: page,
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
}

export async function listPublicFeed(cursor?: string, limit = 20) {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const items = await prisma.intent.findMany({
    where: {
      visibility: 'PUBLIC',
      status: { in: ['PUBLISHED', 'REALIZED'] },
      creator: { status: 'ACTIVE' },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: safeLimit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: publicIntentSelection,
  });

  const hasMore = items.length > safeLimit;
  const page = hasMore ? items.slice(0, safeLimit) : items;

  return {
    items: page,
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
}

export async function listFollowingFeed(viewerId: string, cursor?: string, limit = 20) {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const items = await prisma.intent.findMany({
    where: {
      visibility: { in: ['PUBLIC', 'FOLLOWERS'] },
      status: { in: ['PUBLISHED', 'REALIZED'] },
      creator: {
        status: 'ACTIVE',
        followers: { some: { followerId: viewerId } },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: safeLimit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: publicIntentSelection,
  });

  const hasMore = items.length > safeLimit;
  const page = hasMore ? items.slice(0, safeLimit) : items;

  return {
    items: page,
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
}

export async function getIntent(intentId: string, viewerId?: string) {
  const intent = await prisma.intent.findUnique({
    where: { id: intentId },
    include: {
      creator: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
      },
    },
  });

  if (!intent || (intent.creator.status !== 'ACTIVE' && intent.creatorId !== viewerId)) {
    throw new AppError(404, 'INTENT_NOT_FOUND', 'Intent não encontrada.');
  }

  // Unknown persisted values must never fall through to public access.
  if (!['PUBLIC', 'FOLLOWERS', 'PRIVATE'].includes(intent.visibility)
    || !['PUBLISHED', 'REALIZED', 'CANCELLED'].includes(intent.status)) {
    throw new AppError(403, 'INTENT_FORBIDDEN', 'Esta Intent não está disponível.');
  }

  if (intent.visibility === 'PRIVATE' && intent.creatorId !== viewerId) {
    throw new AppError(403, 'INTENT_FORBIDDEN', 'Você não pode acessar esta Intent.');
  }

  if (intent.visibility === 'FOLLOWERS' && intent.creatorId !== viewerId) {
    const followsCreator = viewerId
      ? await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: viewerId,
              followingId: intent.creatorId,
            },
          },
          select: { id: true },
        })
      : null;

    if (!followsCreator) {
      throw new AppError(403, 'INTENT_FORBIDDEN', 'Esta Intent é visível somente para seguidores.');
    }
  }

  const viewerSupport = viewerId
    ? await prisma.support.findUnique({
        where: { intentId_userId: { intentId, userId: viewerId } },
        select: { id: true },
      })
    : null;

  const {
    revealCiphertext,
    revealIv,
    revealAuthTag,
    ...publicIntent
  } = intent;

  if (intent.status !== 'REALIZED') {
    return { ...publicIntent, revealContent: null, viewerHasSupported: Boolean(viewerSupport) };
  }

  if (!intent.realizedAt || !isSupportConditionSatisfied(intent.supportCount, intent.supportGoal)) {
    throw new AppError(409, 'INTENT_STATE_INVALID', 'O estado da Intent é inconsistente.');
  }

  const revealContent = openReveal(
    {
      ciphertext: revealCiphertext,
      iv: revealIv,
      authTag: revealAuthTag,
    },
    config.revealEncryptionKey,
    revealAssociatedData(intent.id, intent.revealVersion),
  );

  return { ...publicIntent, revealContent, viewerHasSupported: Boolean(viewerSupport) };
}

const SERIALIZABLE_RETRY_LIMIT = 3;

async function runSerializableTransaction<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
      if (!retryable || attempt === SERIALIZABLE_RETRY_LIMIT) throw error;
    }
  }

  throw new Error('Limite de repetição transacional excedido.');
}

async function ensureSupportAccess(
  transaction: Prisma.TransactionClient,
  intent: { creatorId: string; visibility: string },
  supporterId: string,
): Promise<void> {
  if (!['PUBLIC', 'FOLLOWERS'].includes(intent.visibility)) {
    throw new AppError(403, 'INTENT_FORBIDDEN', 'Você não pode apoiar uma Intent privada.');
  }

  if (intent.visibility === 'FOLLOWERS') {
    const followsCreator = await transaction.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: supporterId,
          followingId: intent.creatorId,
        },
      },
      select: { id: true },
    });

    if (!followsCreator) {
      throw new AppError(403, 'INTENT_FORBIDDEN', 'Somente seguidores podem apoiar esta Intent.');
    }
  }
}

export async function supportIntent(intentId: string, supporterId: string) {
  return await runSerializableTransaction(async (transaction) => {
    await requireActiveActor(transaction, supporterId);
    const existing = await transaction.intent.findUnique({
      where: { id: intentId },
      include: { creator: { select: { status: true } } },
    });

    if (!existing || existing.creator.status !== 'ACTIVE') {
      throw new AppError(404, 'INTENT_NOT_FOUND', 'Intent não encontrada.');
    }

    if (existing.creatorId === supporterId) {
      throw new AppError(409, 'CREATOR_CANNOT_SUPPORT', 'O criador não pode apoiar a própria Intent.');
    }

    if (existing.status !== 'PUBLISHED') {
      throw new AppError(409, 'INTENT_NOT_OPEN', 'Esta Intent não está aberta para novos apoios.');
    }

    assertPublishedState(existing);

    await ensureSupportAccess(transaction, existing, supporterId);

    const support = await transaction.support.create({
      data: { intentId, userId: supporterId },
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'SUPPORT_ALREADY_EXISTS', 'Você já apoiou esta Intent.');
      }
      throw error;
    });

    const updated = await transaction.intent.update({
      where: { id: intentId },
      data: { supportCount: { increment: 1 } },
    });

    await transaction.domainEvent.create({
      data: {
        intentId,
        actorId: supporterId,
        type: 'SUPPORT_RECEIVED',
        idempotencyKey: `support-received:${support.id}`,
        payload: {
          supportId: support.id,
          supportCount: updated.supportCount,
          supportGoal: updated.supportGoal,
        },
      },
    });

    let realizedNow = false;
    if (isSupportConditionSatisfied(updated.supportCount, updated.supportGoal)) {
      const result = await transaction.intent.updateMany({
        where: { id: intentId, status: 'PUBLISHED' },
        data: { status: 'REALIZED', realizedAt: new Date() },
      });

      realizedNow = result.count === 1;

      if (!realizedNow) {
        // Abort the entire transaction, including the support and its event.
        throw new AppError(409, 'INTENT_STATE_CONFLICT', 'Não foi possível realizar esta Intent.');
      }

      if (realizedNow) {
        await transaction.domainEvent.create({
          data: {
            intentId,
            actorId: supporterId,
            type: 'INTENT_REALIZED',
            idempotencyKey: `intent-realized:${intentId}:v${updated.revealVersion}`,
            payload: {
              supportCount: updated.supportCount,
              supportGoal: updated.supportGoal,
              revealVersion: updated.revealVersion,
            },
          },
        });
      }
    }

    return {
      intentId,
      supportCount: updated.supportCount,
      supportGoal: updated.supportGoal,
      supported: true,
      realized: realizedNow || updated.status === 'REALIZED',
      realizedNow,
    };
  });
}

export async function removeSupport(intentId: string, supporterId: string) {
  return runSerializableTransaction(async (transaction) => {
    await requireActiveActor(transaction, supporterId);
    const intent = await transaction.intent.findUnique({ where: { id: intentId } });

    if (!intent) {
      throw new AppError(404, 'INTENT_NOT_FOUND', 'Intent não encontrada.');
    }

    if (intent.creatorId === supporterId) {
      throw new AppError(409, 'CREATOR_CANNOT_SUPPORT', 'O criador não participa do apoio à própria Intent.');
    }

    if (intent.status !== 'PUBLISHED') {
      throw new AppError(409, 'SUPPORT_LOCKED_AFTER_REVEAL', 'O apoio não pode ser alterado depois da realização.');
    }

    assertPublishedState(intent);

    const support = await transaction.support.findUnique({
      where: { intentId_userId: { intentId, userId: supporterId } },
    });

    if (!support) {
      return {
        intentId,
        supportCount: intent.supportCount,
        supportGoal: intent.supportGoal,
        supported: false,
        removed: false,
        realized: false,
        realizedNow: false,
      };
    }

    if (intent.supportCount === 0) {
      throw new AppError(409, 'INTENT_STATE_INVALID', 'O estado da Intent é inconsistente.');
    }

    await transaction.support.delete({ where: { id: support.id } });
    const updated = await transaction.intent.update({
      where: { id: intentId },
      data: {
        supportCount: { decrement: 1 },
      },
    });

    await transaction.domainEvent.create({
      data: {
        intentId,
        actorId: supporterId,
        type: 'SUPPORT_REMOVED',
        idempotencyKey: `support-removed:${support.id}`,
        payload: {
          supportId: support.id,
          supportCount: updated.supportCount,
          supportGoal: updated.supportGoal,
        },
      },
    });

    return {
      intentId,
      supportCount: updated.supportCount,
      supportGoal: updated.supportGoal,
      supported: false,
      removed: true,
      realized: false,
      realizedNow: false,
    };
  });
}
