import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAuthenticatedUser } from '../middleware/auth.js';
import { updateProfileSchema } from '../domain/intent-schemas.js';
import { publicUserSelect, toPublicUser } from '../domain/public-user.js';
import { prisma } from '../lib/prisma.js';
import { followUser, getSocialProfile, listConnections, unfollowUser } from '../services/social-service.js';
import { getPublicUserProfile } from '../services/public-profile-service.js';

export const usersRouter = Router();
const userIdSchema = z.string().uuid();
const connectionQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const userSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(40),
  limit: z.coerce.number().int().min(1).max(10).default(10),
});

usersRouter.use(requireAuthenticatedUser);

usersRouter.get('/:id/profile', async (request, response, next) => {
  try {
    const userId = userIdSchema.parse(request.params.id);
    response.json({ data: await getPublicUserProfile(userId, request.appUser?.id) });
  } catch (error) {
    next(error);
  }
});

usersRouter.post('/me/sync', (request, response) => {
  response.status(200).json({ data: toPublicUser(request.appUser!) });
});

usersRouter.get('/me', (request, response) => {
  response.json({ data: toPublicUser(request.appUser!) });
});

usersRouter.get('/search', async (request, response, next) => {
  try {
    const query = userSearchQuerySchema.parse(request.query);
    const normalized = query.q.replace(/^@+/, '').toLowerCase();
    const users = await prisma.user.findMany({
      where: {
        id: { not: request.appUser!.id },
        status: 'ACTIVE',
        OR: [
          { username: { contains: normalized, mode: 'insensitive' } },
          { displayName: { contains: query.q, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ username: 'asc' }, { id: 'asc' }],
      take: query.limit,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
      },
    });
    response.json({ data: { items: users } });
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/me/social', async (request, response, next) => {
  try {
    const profile = await getSocialProfile(request.appUser!.id, request.appUser!.id);
    response.json({ data: profile });
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/:id/social', async (request, response, next) => {
  try {
    const userId = userIdSchema.parse(request.params.id);
    const profile = await getSocialProfile(userId, request.appUser!.id);
    response.json({ data: profile });
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/:id/followers', async (request, response, next) => {
  try {
    const userId = userIdSchema.parse(request.params.id);
    const query = connectionQuerySchema.parse(request.query);
    const connections = await listConnections(userId, request.appUser!.id, 'followers', query.cursor, query.limit);
    response.json({ data: connections });
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/:id/following', async (request, response, next) => {
  try {
    const userId = userIdSchema.parse(request.params.id);
    const query = connectionQuerySchema.parse(request.query);
    const connections = await listConnections(userId, request.appUser!.id, 'following', query.cursor, query.limit);
    response.json({ data: connections });
  } catch (error) {
    next(error);
  }
});

usersRouter.post('/:id/follow', async (request, response, next) => {
  try {
    const userId = userIdSchema.parse(request.params.id);
    const profile = await followUser(request.appUser!.id, userId);
    response.status(201).json({ data: profile });
  } catch (error) {
    next(error);
  }
});

usersRouter.delete('/:id/follow', async (request, response, next) => {
  try {
    const userId = userIdSchema.parse(request.params.id);
    const profile = await unfollowUser(request.appUser!.id, userId);
    response.json({ data: profile });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/me', async (request, response, next) => {
  try {
    const changes = updateProfileSchema.parse(request.body);
    const data: Prisma.UserUpdateInput = {};
    if (changes.displayName !== undefined) data.displayName = changes.displayName;
    if (changes.bio !== undefined) data.bio = changes.bio;
    if (changes.avatarUrl !== undefined) data.avatarUrl = changes.avatarUrl;

    const user = await prisma.user.update({
      where: { id: request.appUser!.id },
      data,
      select: publicUserSelect,
    });
    response.json({ data: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});
