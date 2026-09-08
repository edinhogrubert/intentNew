import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { prisma } from '../lib/prisma.js';

export const idempotencyKeySchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/).optional();
const RETRY_LIMIT = 3;
class ReservationConflict extends Error {}

type JsonResult<T> = T extends Date ? string : T extends Array<infer U> ? JsonResult<U>[]
  : T extends object ? { [K in keyof T]: JsonResult<T[K]> } : T;

// The snapshot has the same JSON representation as the existing HTTP response.
function snapshot<T>(result: T): JsonResult<T> {
  return JSON.parse(JSON.stringify(result)) as JsonResult<T>;
}

export async function runIntentMutation<T>(
  actorId: string,
  operation: string,
  suppliedKey: string | undefined,
  command: unknown,
  mutate: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<JsonResult<T>> {
  const key = idempotencyKeySchema.parse(suppliedKey);
  // Do not persist the command (which may contain an unrevealed secret), nor an
  // unkeyed digest that would allow offline guessing of low-entropy content.
  const requestHash = key === undefined ? undefined : createHmac('sha256', config.revealEncryptionKey)
    .update('intent-idempotency:v1:').update(JSON.stringify(command)).digest('hex');

  for (let attempt = 1; attempt <= RETRY_LIMIT; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const actor = await transaction.user.findUnique({ where: { id: actorId }, select: { status: true } });
        if (!actor || actor.status !== 'ACTIVE') {
          throw new AppError(403, 'ACCOUNT_INACTIVE', 'Esta conta não está ativa.');
        }
        if (key === undefined) return snapshot(await mutate(transaction));

        const where = { actorId_operation_key: { actorId, operation, key } };
        const existing = await transaction.idempotencyRequest.findUnique({ where });
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'Esta chave já foi usada com outros dados.');
          }
          if (existing.response === null) {
            throw new AppError(409, 'IDEMPOTENCY_INCOMPLETE', 'Esta operação ainda não possui resultado.');
          }
          return existing.response as JsonResult<T>;
        }

        // Reserve before changing domain state. A competing INSERT waits for
        // commit/rollback and then retries with a fresh serializable snapshot.
        await transaction.idempotencyRequest.create({
          data: { actorId, operation, key, requestHash: requestHash! },
        }).catch((error: unknown) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ReservationConflict();
          }
          throw error;
        });
        const result = snapshot(await mutate(transaction));
        await transaction.idempotencyRequest.update({
          where, data: { response: result as Prisma.InputJsonValue },
        });
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable = error instanceof ReservationConflict
        || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034');
      if (!retryable) throw error;
      if (attempt === RETRY_LIMIT) {
        throw new AppError(409, 'INTENT_STATE_CONFLICT', 'Conflito temporário. Reenvie com a mesma chave.');
      }
    }
  }
  throw new Error('Limite de repetição transacional excedido.');
}
