import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { firebaseAuth } from '../lib/firebase.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors.js';

function normalizeUsername(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || 'usuario';
}

async function findAvailableUsername(base: string): Promise<string> {
  for (let suffix = 1; suffix <= 9999; suffix += 1) {
    const suffixText = suffix === 1 ? '' : String(suffix);
    const candidate = `${base.slice(0, 40 - suffixText.length)}${suffixText}`;
    const existing = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });

    if (!existing) return candidate;
  }

  throw new AppError(409, 'USERNAME_UNAVAILABLE', 'Não foi possível reservar um nome de usuário.');
}

async function verifyBearerToken(request: Request, required: boolean): Promise<DecodedIdToken | null> {
  const authorization = request.header('authorization');
  if (!authorization) {
    if (required) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Entre na sua conta para continuar.');
    }
    return null;
  }

  if (!authorization.startsWith('Bearer ')) {
    throw new AppError(401, 'AUTH_INVALID', 'Formato de autenticação inválido.');
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Token de autenticação ausente.');
  }

  try {
    return await firebaseAuth.verifyIdToken(token, false);
  } catch (error) {
    request.log.warn({ err: error }, 'Token verification failed');
    throw new AppError(401, 'AUTH_INVALID', 'Sua sessão não é válida ou expirou.');
  }
}

async function attachUser(request: Request, decoded: DecodedIdToken): Promise<void> {
  const tokenName = typeof decoded.name === 'string' ? decoded.name.trim() : '';
  const tokenPicture = typeof decoded.picture === 'string' ? decoded.picture : undefined;
  const normalizedEmail = typeof decoded.email === 'string' ? decoded.email.toLowerCase() : undefined;
  const displayName = tokenName || normalizedEmail?.split('@')[0] || 'Usuário Intent';
  const usernameBase = normalizeUsername(displayName);

  request.auth = {
    firebaseUid: decoded.uid,
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
    ...(tokenName ? { name: tokenName } : {}),
    ...(tokenPicture ? { picture: tokenPicture } : {}),
  };

  const existingUser = await prisma.user.findUnique({
    where: { firebaseUid: decoded.uid },
  });

  if (existingUser) {
    if (existingUser.status !== 'ACTIVE') {
      throw new AppError(403, 'ACCOUNT_INACTIVE', 'Esta conta não está ativa.');
    }

    const legacyUsername = `${usernameBase}_${decoded.uid.slice(0, 8).toLowerCase()}`;
    const shouldUpgradeUsername = existingUser.username === legacyUsername;
    const username = shouldUpgradeUsername
      ? await findAvailableUsername(usernameBase)
      : existingUser.username;

    request.appUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        username,
      },
    });
    return;
  }

  const username = await findAvailableUsername(usernameBase);
  request.appUser = await prisma.user.create({
    data: {
      firebaseUid: decoded.uid,
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      displayName,
      username,
      ...(tokenPicture ? { avatarUrl: tokenPicture } : {}),
    },
  });
}

async function authenticate(request: Request, required: boolean): Promise<void> {
  const decoded = await verifyBearerToken(request, required);
  if (decoded) {
    await attachUser(request, decoded);
  }
}

export async function requireAuthenticatedUser(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await authenticate(request, true);
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuthenticatedUser(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await authenticate(request, false);
    next();
  } catch (error) {
    next(error);
  }
}
