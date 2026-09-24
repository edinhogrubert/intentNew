import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { db, verifyIdToken } = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    intent: { findMany: vi.fn().mockResolvedValue([{ id: '20000000-0000-4000-8000-000000000001' }]) },
    notification: {
      count: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => callback(db)),
  },
  verifyIdToken: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({ prisma: db, isTransientDbError: () => false }));
vi.mock('../src/lib/firebase.js', () => ({ firebaseAuth: { verifyIdToken } }));
vi.mock('../src/config.js', () => ({
  config: {
    corsOrigins: ['http://localhost:3000'],
    logLevel: 'silent',
    revealEncryptionKey: Buffer.alloc(32, 7),
  },
}));

import { createApp } from '../src/app.js';

const userA = {
  id: '10000000-0000-4000-8000-000000000001',
  firebaseUid: 'firebase-user-a',
  email: 'a@example.com',
  username: 'usera',
  displayName: 'User A',
  bio: null,
  avatarUrl: null,
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockNotification = {
  id: '30000000-0000-4000-8000-000000000001',
  userId: userA.id,
  type: 'INTENT_REACTION_RECEIVED',
  readAt: null,
  createdAt: new Date(),
  actor: {
    id: '10000000-0000-4000-8000-000000000002',
    username: 'userb',
    displayName: 'User B',
    avatarUrl: null,
  },
  intent: {
    id: '20000000-0000-4000-8000-000000000001',
    title: 'Minha Intent',
  },
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server = createApp().listen(0, '127.0.0.1', () => resolve());
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  verifyIdToken.mockResolvedValue({ uid: userA.firebaseUid });
  db.user.findUnique.mockResolvedValue(userA);
  db.user.update.mockResolvedValue(userA);
});

describe('Notification HTTP Endpoints', () => {
  it('GET /v1/notifications returns list of notifications for authenticated user', async () => {
    db.notification.findMany.mockResolvedValue([mockNotification]);

    const res = await fetch(`${baseUrl}/v1/notifications`, {
      headers: { Authorization: 'Bearer token-a' },
    });
    const json = await res.json() as any;

    expect(res.status).toBe(200);
    expect(json.data.items).toHaveLength(1);
    expect(json.data.items[0].id).toBe(mockNotification.id);
  });

  it('GET /v1/notifications/unread-count returns unread count', async () => {
    db.notification.count.mockResolvedValue(3);

    const res = await fetch(`${baseUrl}/v1/notifications/unread-count`, {
      headers: { Authorization: 'Bearer token-a' },
    });
    const json = await res.json() as any;

    expect(res.status).toBe(200);
    expect(json.data.unreadCount).toBe(3);
  });

  it('POST /v1/notifications/:id/read marks notification as read', async () => {
    db.notification.updateMany.mockResolvedValue({ count: 1 });
    db.notification.findFirst.mockResolvedValue({
      ...mockNotification,
      readAt: new Date(),
    });

    const res = await fetch(`${baseUrl}/v1/notifications/${mockNotification.id}/read`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-a' },
    });
    const json = await res.json() as any;

    expect(res.status).toBe(200);
    expect(json.data.id).toBe(mockNotification.id);
    expect(json.data.readAt).not.toBeNull();
  });

  it('POST /v1/notifications/read-all marks all notifications as read', async () => {
    db.notification.updateMany.mockResolvedValue({ count: 2 });

    const res = await fetch(`${baseUrl}/v1/notifications/read-all`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-a' },
    });
    const json = await res.json() as any;

    expect(res.status).toBe(200);
    expect(json.data.success).toBe(true);
  });
});
