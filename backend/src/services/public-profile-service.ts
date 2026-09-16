import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors.js';
import { publicUserSelect, toPublicUser } from '../domain/public-user.js';

export async function getPublicUserProfile(userId: string, viewerId?: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, status: 'ACTIVE' },
    select: publicUserSelect,
  });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Perfil não encontrado.');

  const scope = {
    creatorId: userId,
    visibility: 'PUBLIC',
    status: { in: ['PUBLISHED', 'REALIZED'] },
    creator: { status: 'ACTIVE' },
  };

  const isMe = Boolean(viewerId && userId === viewerId);

  const [
    intentsCreated,
    intentsRealized,
    totalSupportReceived,
    totalReactionsReceived,
    totalCommentsReceived,
    followersCount,
    followingCount,
    followRelation,
    intents,
  ] = await Promise.all([
    prisma.intent.count({ where: scope }),
    prisma.intent.count({ where: { ...scope, status: 'REALIZED' } }),
    prisma.support.count({ where: { intent: scope } }),
    prisma.intentReaction.count({ where: { intent: scope } }),
    prisma.intentComment.count({ where: { intent: scope, author: { status: 'ACTIVE' } } }),
    prisma.follow.count({ where: { followingId: userId, follower: { status: 'ACTIVE' } } }),
    prisma.follow.count({ where: { followerId: userId, following: { status: 'ACTIVE' } } }),
    viewerId && !isMe
      ? prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: viewerId, followingId: userId } },
          select: { id: true },
        })
      : Promise.resolve(null),
    prisma.intent.findMany({
      where: scope,
      take: 20,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        title: true,
        story: true,
        status: true,
        createdAt: true,
        supportCount: true,
      },
    }),
  ]);

  return {
    ...toPublicUser(user),
    isMe,
    viewerIsFollowing: Boolean(followRelation),
    stats: {
      intentsCreated,
      intentsRealized,
      totalSupportReceived,
      totalReactionsReceived,
      totalCommentsReceived,
      publicIntentsCount: intentsCreated,
      followersCount,
      followingCount,
    },
    intents,
  };
}
