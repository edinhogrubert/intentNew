import { Router } from 'express';
import { z } from 'zod';
import { createIntentSchema } from '../domain/intent-schemas.js';
import { createCommentSchema } from '../domain/comment-schemas.js';
import { setReactionSchema } from '../domain/reaction-schemas.js';
import { AppError } from '../errors.js';
import { optionalAuthenticatedUser, requireAuthenticatedUser } from '../middleware/auth.js';
import {
  approveGuardianIntent,
  createIntent,
  getIntent,
  listGuardianRequests,
  listIntentSupporters,
  listUserIntents,
  listFollowingFeed,
  listPublicFeed,
  listSocialFeed,
  removeSupport,
  supportIntent,
} from '../services/intent-service.js';
import { createIntentComment, listIntentComments } from '../services/comment-service.js';
import { removeIntentReaction, setIntentReaction } from '../services/reaction-service.js';
import { listWatchedIntents, unwatchIntent, watchIntent } from '../services/intent-watch-service.js';
import { listIntentHistory } from '../services/intent-history-service.js';

export const intentsRouter = Router();

const identifierSchema = z.string().uuid();
const feedQuerySchema = z.object({
  scope: z.enum(['public', 'following', 'all']).default('public'),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const socialFeedQuerySchema = z.object({ filter: z.enum(['recent', 'realized', 'supported', 'mine', 'popular']).default('recent'), cursor: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
const historyQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();
intentsRouter.get('/social-feed', requireAuthenticatedUser, async (request, response, next) => {
  try { const query = socialFeedQuerySchema.parse(request.query); response.json({ data: await listSocialFeed(request.appUser!.id, query.filter, query.cursor, query.limit) }); } catch (error) { next(error); }
});
intentsRouter.get('/watched', requireAuthenticatedUser, async (request, response, next) => {
  try {
    const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined;
    const limit = typeof request.query.limit === 'string' ? Number(request.query.limit) : 20;
    response.json({ data: await listWatchedIntents(request.appUser!.id, cursor, Number.isFinite(limit) ? limit : 20) });
  } catch (error) { next(error); }
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

intentsRouter.get('/guardian-requests', requireAuthenticatedUser, async (request, response, next) => {
  try {
    const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined;
    const limit = typeof request.query.limit === 'string' ? Number(request.query.limit) : 20;
    const intents = await listGuardianRequests(
      request.appUser!.id,
      cursor,
      Number.isFinite(limit) ? limit : 20,
    );
    response.json({ data: intents });
  } catch (error) {
    next(error);
  }
});

intentsRouter.get('/:id/history', requireAuthenticatedUser, async (request, response, next) => {
  try {
    const intentId = identifierSchema.parse(request.params.id);
    const query = historyQuerySchema.parse(request.query);
    response.json({ data: await listIntentHistory(intentId, request.appUser!.id, query.cursor, query.limit) });
  } catch (error) {
    next(error);
  }
});

intentsRouter.get('/:id/comments', requireAuthenticatedUser, async (request, response, next) => {
  try {
    const intentId = identifierSchema.parse(request.params.id);
    const comments = await listIntentComments(intentId, request.appUser!.id);
    response.json({ data: { items: comments } });
  } catch (error) {
    next(error);
  }
});

intentsRouter.post('/:id/comments', requireAuthenticatedUser, async (request, response, next) => {
  try {
    const intentId = identifierSchema.parse(request.params.id);
    const command = createCommentSchema.parse(request.body);
    const comment = await createIntentComment(intentId, request.appUser!.id, command);
    response.status(201).json({ data: comment });
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

intentsRouter.get('/:id/supports', optionalAuthenticatedUser, async (request, response, next) => {
  try {
    const intentId = identifierSchema.parse(request.params.id);
    const supporters = await listIntentSupporters(intentId, request.appUser?.id);
    response.json({ data: supporters });
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

intentsRouter.post('/:id/guardian-approvals', requireAuthenticatedUser, async (request, response, next) => {
  try {
    const intentId = identifierSchema.parse(request.params.id);
    const result = await approveGuardianIntent(intentId, request.appUser!.id, request.get('Idempotency-Key'));
    response.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

intentsRouter.post('/:id/reactions', requireAuthenticatedUser, async (request, response, next) => {
  try {
    const intentId = identifierSchema.parse(request.params.id);
    const command = setReactionSchema.parse(request.body);
    const result = await setIntentReaction(intentId, request.appUser!.id, command.type);
    response.json({ data: result });
  } catch (error) {
    next(error);
  }
});

intentsRouter.post('/:id/watch', requireAuthenticatedUser, async (request, response, next) => {
  try {
    const intentId = identifierSchema.parse(request.params.id);
    response.json({ data: await watchIntent(intentId, request.appUser!.id) });
  } catch (error) { next(error); }
});

intentsRouter.delete('/:id/watch', requireAuthenticatedUser, async (request, response, next) => {
  try {
    const intentId = identifierSchema.parse(request.params.id);
    response.json({ data: await unwatchIntent(intentId, request.appUser!.id) });
  } catch (error) { next(error); }
});

intentsRouter.delete('/:id/reactions', requireAuthenticatedUser, async (request, response, next) => {
  try {
    const intentId = identifierSchema.parse(request.params.id);
    const result = await removeIntentReaction(intentId, request.appUser!.id);
    response.json({ data: result });
  } catch (error) {
    next(error);
  }
});
