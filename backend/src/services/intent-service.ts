import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { prisma } from '../lib/prisma.js';
import { openReveal, revealAssociatedData, sealReveal } from '../domain/reveal-crypto.js';
import { isSupportConditionSatisfied } from '../domain/support-condition.js';
import { createIntentSchema } from '../domain/intent-schemas.js';
import { runIntentMutation } from './intent-mutation.js';
import { createNotification } from './notification-service.js';
import { getIntentReactionSummary } from './reaction-service.js';

const publicIntentSelection = {
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
  guardianIds: true,
  guardianApprovals: true,
  guardianApprovalGoal: true,
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

function assertPublishedState(intent: { supportCount: number; supportGoal: number; realizedAt: Date | null }) {
  if (!Number.isInteger(intent.supportCount) || intent.supportCount < 0
    || !Number.isInteger(intent.supportGoal) || intent.supportGoal < 1
    || intent.supportCount >= intent.supportGoal || intent.realizedAt != null) {
    throw new AppError(409, 'INTENT_STATE_INVALID', 'O estado da Intent é inconsistente.');
  }
}

function asStringArray(value: Prisma.JsonValue | unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

type IntentAccessClient = Pick<Prisma.TransactionClient, 'intent' | 'follow'>;

interface IntentViewAccessRecord {
  creatorId: string;
  visibility: string;
  status: string;
  guardianIds?: Prisma.JsonValue | unknown;
  creator?: { status: string } | null;
}

async function assertIntentViewAccess<T extends IntentViewAccessRecord>(
  intent: T | null,
  viewerId: string | undefined,
  client: IntentAccessClient,
): Promise<T> {
  if (!intent || (intent.creator && intent.creator.status !== 'ACTIVE' && intent.creatorId !== viewerId)) {
    throw new AppError(404, 'INTENT_NOT_FOUND', 'Intent não encontrada.');
  }

  if (!['PUBLIC', 'FOLLOWERS', 'PRIVATE'].includes(intent.visibility)
    || !['PUBLISHED', 'REALIZED', 'CANCELLED'].includes(intent.status)) {
    throw new AppError(403, 'INTENT_FORBIDDEN', 'Esta Intent não está disponível.');
  }

  const viewerIsGuardian = Boolean(viewerId && asStringArray(intent.guardianIds).includes(viewerId));
  if (intent.visibility === 'PRIVATE' && intent.creatorId !== viewerId && !viewerIsGuardian) {
    throw new AppError(403, 'INTENT_FORBIDDEN', 'Você não pode acessar esta Intent.');
  }

  if (intent.visibility === 'FOLLOWERS' && intent.creatorId !== viewerId) {
    const followsCreator = viewerId
      ? await client.follow.findUnique({
          where: { followerId_followingId: { followerId: viewerId, followingId: intent.creatorId } },
          select: { id: true },
        })
      : null;
    if (!followsCreator) {
      throw new AppError(403, 'INTENT_FORBIDDEN', 'Esta Intent é visível somente para seguidores.');
    }
  }
  return intent;
}

export async function requireIntentViewAccess(
  intentId: string,
  viewerId?: string,
  client: IntentAccessClient = prisma,
): Promise<void> {
  const intent = await client.intent.findUnique({
    where: { id: intentId },
    select: {
      creatorId: true,
      visibility: true,
      status: true,
      guardianIds: true,
      creator: { select: { status: true } },
    },
  });
  await assertIntentViewAccess(intent, viewerId, client);
}

function isRevealConditionSatisfied(intent: {
  conditionType: string;
  supportCount: number;
  supportGoal: number;
  revealAt: Date | null;
  guardianIds: Prisma.JsonValue | unknown;
  guardianApprovals: Prisma.JsonValue | unknown;
  guardianApprovalGoal: number | null;
}): boolean {
  if (intent.conditionType === 'SUPPORT') {
    return isSupportConditionSatisfied(intent.supportCount, intent.supportGoal);
  }
  if (intent.conditionType === 'DATE') {
    return Boolean(intent.revealAt && intent.revealAt.getTime() <= Date.now());
  }
  if (intent.conditionType === 'GUARDIANS') {
    const guardianIds = new Set(asStringArray(intent.guardianIds));
    const approvals = asStringArray(intent.guardianApprovals).filter((id) => guardianIds.has(id));
    return approvals.length >= (intent.guardianApprovalGoal ?? guardianIds.size);
  }
  return false;
}

function publicGuardianIds(intent: { creatorId: string; guardianIds: Prisma.JsonValue | unknown }, viewerId?: string) {
  if (intent.creatorId === viewerId) return asStringArray(intent.guardianIds);
  return undefined;
}

function publicGuardianApprovals(intent: { creatorId: string; guardianApprovals: Prisma.JsonValue | unknown }, viewerId?: string) {
  if (intent.creatorId === viewerId) return asStringArray(intent.guardianApprovals);
  return undefined;
}

// Actor IDs come from the authenticated server context, never from command fields.
export async function createIntent(creatorId: string, input: unknown, idempotencyKey?: string) {
  const command = createIntentSchema.parse(input);
  const intentId = randomUUID();
  const revealVersion = 1;
  const sealed = sealReveal(
    command.revealContent,
    config.revealEncryptionKey,
    revealAssociatedData(intentId, revealVersion),
  );

  return runIntentMutation(creatorId, 'CREATE_INTENT', idempotencyKey, command, async (transaction) => {
    const intent = await transaction.intent.create({
      data: {
        id: intentId,
        creatorId,
        type: 'SUPPORT_REVEAL',
        conditionType: command.conditionType,
        status: 'PUBLISHED',
        supportCount: 0,
        realizedAt: null,
        title: command.title,
        story: command.story,
        category: command.category,
        supportGoal: command.supportGoal ?? command.guardianApprovalGoal ?? 1,
        visibility: command.visibility,
        revealAt: command.revealAt ?? null,
        guardianIds: command.guardianIds ?? [],
        guardianApprovals: [],
        guardianApprovalGoal: command.guardianApprovalGoal ?? null,
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
          conditionType: command.conditionType,
          supportGoal: command.supportGoal ?? null,
          revealAt: command.revealAt?.toISOString() ?? null,
          guardianCount: command.guardianIds?.length ?? 0,
          guardianApprovalGoal: command.guardianApprovalGoal ?? null,
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

export async function listGuardianRequests(guardianId: string, cursor?: string, limit = 20) {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const items = await prisma.intent.findMany({
    where: {
      conditionType: 'GUARDIANS',
      status: { in: ['PUBLISHED', 'REALIZED'] },
      creatorId: { not: guardianId },
      creator: { status: 'ACTIVE' },
      guardianIds: { array_contains: [guardianId] },
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
  let intent = await prisma.intent.findUnique({
    where: { id: intentId },
    include: {
      creator: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
      },
    },
  });

  intent = await assertIntentViewAccess(intent, viewerId, prisma);

  const viewerIsGuardian = Boolean(viewerId && asStringArray(intent.guardianIds).includes(viewerId));

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
    guardianIds: _guardianIds,
    guardianApprovals: _guardianApprovals,
    ...publicIntent
  } = intent;

  if (intent.status === 'PUBLISHED' && isRevealConditionSatisfied(intent)) {
    const result = await prisma.intent.updateMany({
      where: { id: intentId, status: 'PUBLISHED' },
      data: { status: 'REALIZED', realizedAt: new Date() },
    });
    if (result.count === 1) {
      intent = await prisma.intent.findUniqueOrThrow({
        where: { id: intentId },
        include: {
          creator: {
            select: { id: true, username: true, displayName: true, avatarUrl: true, status: true },
          },
        },
      });
    }
  }

  const { reactionCounts, viewerReaction } = await getIntentReactionSummary(intentId, viewerId);

  if (intent.status !== 'REALIZED') {
    return {
      ...publicIntent,
      guardianIds: publicGuardianIds(intent, viewerId),
      guardianApprovals: publicGuardianApprovals(intent, viewerId),
      viewerIsGuardian,
      viewerHasApprovedAsGuardian: Boolean(viewerId && asStringArray(intent.guardianApprovals).includes(viewerId)),
      revealContent: null,
      viewerHasSupported: Boolean(viewerSupport),
      reactionCounts,
      viewerReaction,
    };
  }

  if (!intent.realizedAt || !isRevealConditionSatisfied(intent)) {
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

  const { revealCiphertext: _c, revealIv: _i, revealAuthTag: _a, guardianIds: _g, guardianApprovals: _ga, ...realizedPublicIntent } = intent;
  return {
    ...realizedPublicIntent,
    guardianIds: publicGuardianIds(intent, viewerId),
    guardianApprovals: publicGuardianApprovals(intent, viewerId),
    viewerIsGuardian,
    viewerHasApprovedAsGuardian: Boolean(viewerId && asStringArray(intent.guardianApprovals).includes(viewerId)),
    revealContent,
    viewerHasSupported: Boolean(viewerSupport),
    reactionCounts,
    viewerReaction,
  };
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

export async function supportIntent(intentId: string, supporterId: string, idempotencyKey?: string) {
  intentId = intentId.toLowerCase();
  return runIntentMutation(supporterId, `SUPPORT_INTENT:${intentId}`, idempotencyKey, { intentId }, async (transaction) => {
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

    if (existing.conditionType !== 'SUPPORT') {
      throw new AppError(409, 'INTENT_NOT_SUPPORT_BASED', 'Esta Intent não usa apoios como condição.');
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

    await createNotification(transaction, {
      userId: existing.creatorId,
      actorId: supporterId,
      type: 'SUPPORT_RECEIVED',
      intentId,
      deduplicationKey: `support:${support.id}`,
    });

    let realizedNow = false;
    if (isRevealConditionSatisfied(updated)) {
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

export async function approveGuardianIntent(intentId: string, guardianId: string, idempotencyKey?: string) {
  intentId = intentId.toLowerCase();
  return runIntentMutation(guardianId, `GUARDIAN_APPROVE:${intentId}`, idempotencyKey, { intentId }, async (transaction) => {
    const intent = await transaction.intent.findUnique({
      where: { id: intentId },
      include: { creator: { select: { status: true } } },
    });

    if (!intent || intent.creator.status !== 'ACTIVE') {
      throw new AppError(404, 'INTENT_NOT_FOUND', 'Intent não encontrada.');
    }
    if (intent.conditionType !== 'GUARDIANS') {
      throw new AppError(409, 'INTENT_NOT_GUARDIAN_BASED', 'Esta Intent não usa guardiões como condição.');
    }
    if (intent.status !== 'PUBLISHED') {
      throw new AppError(409, 'INTENT_NOT_OPEN', 'Esta Intent não está aberta para aprovação.');
    }

    const guardianIds = asStringArray(intent.guardianIds);
    if (!guardianIds.includes(guardianId)) {
      throw new AppError(403, 'INTENT_FORBIDDEN', 'Você não é guardião desta Intent.');
    }

    const approvals = new Set(asStringArray(intent.guardianApprovals));
    const hadApproved = approvals.has(guardianId);
    approvals.add(guardianId);
    const nextApprovals = [...approvals];

    const updated = await transaction.intent.update({
      where: { id: intentId },
      data: { guardianApprovals: nextApprovals },
    });

    if (!hadApproved) {
      await transaction.domainEvent.create({
        data: {
          intentId,
          actorId: guardianId,
          type: 'GUARDIAN_APPROVED',
          idempotencyKey: `guardian-approved:${intentId}:${guardianId}`,
          payload: {
            approvals: nextApprovals.length,
            guardianApprovalGoal: updated.guardianApprovalGoal,
          },
        },
      });
      await createNotification(transaction, {
        userId: intent.creatorId,
        actorId: guardianId,
        type: 'GUARDIAN_APPROVAL_RECEIVED',
        intentId,
        deduplicationKey: `guardian-approval:${intentId}:${guardianId}`,
      });
    }

    let realizedNow = false;
    if (isRevealConditionSatisfied(updated)) {
      const result = await transaction.intent.updateMany({
        where: { id: intentId, status: 'PUBLISHED' },
        data: { status: 'REALIZED', realizedAt: new Date() },
      });
      realizedNow = result.count === 1;
      if (realizedNow) {
        await transaction.domainEvent.create({
          data: {
            intentId,
            actorId: guardianId,
            type: 'INTENT_REALIZED',
            idempotencyKey: `intent-realized:${intentId}:v${updated.revealVersion}`,
            payload: {
              conditionType: updated.conditionType,
              guardianApprovalGoal: updated.guardianApprovalGoal,
              approvals: nextApprovals.length,
              revealVersion: updated.revealVersion,
            },
          },
        });
      }
    }

    return {
      intentId,
      approved: true,
      approvals: nextApprovals.length,
      guardianApprovalGoal: updated.guardianApprovalGoal,
      realized: realizedNow || updated.status === 'REALIZED',
      realizedNow,
    };
  });
}

export async function removeSupport(intentId: string, supporterId: string, idempotencyKey?: string) {
  intentId = intentId.toLowerCase();
  return runIntentMutation(supporterId, `REMOVE_SUPPORT:${intentId}`, idempotencyKey, { intentId }, async (transaction) => {
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

export async function listIntentSupporters(intentId: string, viewerId?: string, limit = 12) {
  intentId = intentId.toLowerCase();
  await requireIntentViewAccess(intentId, viewerId, prisma);

  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const supports = await prisma.support.findMany({
    where: { intentId },
    orderBy: { createdAt: 'desc' },
    take: safeLimit,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  return supports.map((s) => ({
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    user: s.user,
  }));
}
