import { Prisma } from '@prisma/client';
import { AppError } from '../errors.js';
import { createCommentSchema } from '../domain/comment-schemas.js';
import { prisma } from '../lib/prisma.js';
import { requireIntentViewAccess } from './intent-service.js';
import { createNotification } from './notification-service.js';

export const commentSelect = {
  id: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.IntentCommentSelect;

type CommentProjection = Prisma.IntentCommentGetPayload<{ select: typeof commentSelect }>;

function toPublicComment(comment: CommentProjection) {
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: {
      id: comment.author.id,
      username: comment.author.username,
      displayName: comment.author.displayName,
      avatarUrl: comment.author.avatarUrl,
    },
  };
}

export async function listIntentComments(intentId: string, viewerId: string, limit = 50) {
  await requireIntentViewAccess(intentId, viewerId);
  const comments = await prisma.intentComment.findMany({
    where: { intentId, author: { status: 'ACTIVE' } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: Math.min(Math.max(limit, 1), 50),
    select: commentSelect,
  });
  return comments.map(toPublicComment);
}

export async function createIntentComment(intentId: string, authorId: string, input: unknown) {
  const command = createCommentSchema.parse(input);
  return prisma.$transaction(async (transaction) => {
    await requireIntentViewAccess(intentId, authorId, transaction);
    const intent = await transaction.intent.findUnique({
      where: { id: intentId },
      select: { creatorId: true, status: true },
    });
    if (intent?.status === 'DRAFT') {
      throw new AppError(400, 'INTENT_NOT_PUBLISHED', 'Não é possível comentar em uma Intent em rascunho.');
    }
    const comment = await transaction.intentComment.create({
      data: { intentId, authorId, body: command.body },
      select: commentSelect,
    });
    if (intent && intent.creatorId !== authorId) {
      await createNotification(transaction, {
        userId: intent.creatorId,
        actorId: authorId,
        type: 'INTENT_COMMENT_RECEIVED',
        intentId,
        deduplicationKey: `comment:${comment.id}`,
      });
    }
    return toPublicComment(comment);
  });
}
