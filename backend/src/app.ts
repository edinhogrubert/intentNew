import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { config } from './config.js';
import { AppError } from './errors.js';
import { logger } from './lib/logger.js';
import { healthRouter } from './routes/health.js';
import { intentsRouter } from './routes/intents.js';
import { usersRouter } from './routes/users.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new AppError(403, 'ORIGIN_FORBIDDEN', 'Origem não autorizada.'));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id', 'Idempotency-Key'],
  }));
  app.use(pinoHttp({
    logger,
    genReqId(request, response) {
      const supplied = request.headers['x-request-id'];
      const requestId = typeof supplied === 'string' && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied)
        ? supplied
        : randomUUID();
      response.setHeader('X-Request-Id', requestId);
      return requestId;
    },
  }));
  app.use(express.json({ limit: '128kb' }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', service: 'intent-api' });
  });
  app.use('/health', healthRouter);
  app.use('/v1/users', usersRouter);
  app.use('/v1/intents', intentsRouter);

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: 'ROUTE_NOT_FOUND', message: 'Rota não encontrada.' },
    });
  });

  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    const parserError = error as { status?: number; type?: string };
    if (error instanceof SyntaxError && parserError.status === 400) {
      response.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'O corpo da requisição contém JSON inválido.',
          requestId: request.id,
        },
      });
      return;
    }

    if (parserError.type === 'entity.too.large') {
      response.status(413).json({
        error: {
          code: 'BODY_TOO_LARGE',
          message: 'O corpo da requisição excede o limite permitido.',
          requestId: request.id,
        },
      });
      return;
    }

    if (error instanceof ZodError) {
      response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Revise os dados informados.',
          fields: error.flatten(),
          requestId: request.id,
        },
      });
      return;
    }

    if (error instanceof AppError) {
      response.status(error.statusCode).json({
        error: { code: error.code, message: error.message, requestId: request.id },
      });
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      response.status(409).json({
        error: {
          code: 'RESOURCE_CONFLICT',
          message: 'Já existe um registro com esses dados.',
          requestId: request.id,
        },
      });
      return;
    }

    request.log.error({ err: error }, 'Erro não tratado');
    response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Não foi possível concluir a operação.',
        requestId: request.id,
      },
    });
  });

  return app;
}
