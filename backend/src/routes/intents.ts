import { Router } from 'express';
import { z } from 'zod';
import { createIntentSchema } from '../domain/intent-schemas.js';
import { AppError } from '../errors.js';
import { optionalAuthenticatedUser, requireAuthenticatedUser } from '../middleware/auth.js';
import {
  createIntent,
  getIntent,
  listUserIntents,
  listFollowingFeed,
  listPublicFeed,
  removeSupport,
  supportIntent,
} from '../services/intent-service.js';

export const intentsRouter = Router();

const identifierSchema = z.string().uuid();
const feedQuerySchema = z.object({
  scope: z.enum(['public', 'following']).default('public'),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

intentsRouter.get('/feed', optionalAuthenticatedUser, async (request, response, next) => {
  try {
    const query = feedQuerySchema.parse(request.query);
    if (query.scope === 'following' && !request.appUser) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Entre na sua conta para ver quem você segue.');
    }
    const feed = query.scope === 'following'
      ? await listFollowingFeed(request.appUser!.id, query.cursor, query.limit)
      : await listPublicFeed(query.cursor, query.limit);
    response.json({ data: feed });
  } catch (error) {
    next(error);
  }
});

intentsRouter.get('/mine', requireAuthenticatedUser, async (request, response, next) => {
  try {
    const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined;
    const limit = typeof request.query.limit === 'string' ? Number(request.query.limit) : 20;
    const intents = await listUserIntents(
      request.appUser!.id,
      cursor,
      Number.isFinite(limit) ? limit : 20,
    );
    response.json({ data: intents });
  } catch (error) {
    next(error);
  }
});

intentsRouter.get('/:id', optionalAuthenticatedUser, async (request, response, next) => {
  try {
    const intentId = identifierSchema.parse(request.params.id);
    const intent = await getIntent(intentId, request.appUser?.id);
    response.json({ data: intent });
  } catch (error) {
    next(error);
  }
});

intentsRouter.post('/', requireAuthenticatedUser, async (request, response, next) => {
  try {
    const command = createIntentSchema.parse(request.body);
    const intent = await createIntent(request.appUser!.id, command, request.get('Idempotency-Key'));
    response.status(201).json({ data: intent });
  } catch (error) {
    next(error);
  }
});

intentsRouter.post('/:id/supports', requireAuthenticatedUser, async (request, response, next) => {
  try {
    const intentId = identifierSchema.parse(request.params.id);
    const result = await supportIntent(intentId, request.appUser!.id, request.get('Idempotency-Key'));
    response.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

intentsRouter.delete('/:id/supports', requireAuthenticatedUser, async (request, response, next) => {
  try {
    const intentId = identifierSchema.parse(request.params.id);
    const result = await removeSupport(intentId, request.appUser!.id, request.get('Idempotency-Key'));
    response.json({ data: result });
  } catch (error) {
    next(error);
  }
});
