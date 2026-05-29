import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldDispatch, dispatchCore } from './dispatch';
import type { Env } from '../env';

// Mock the web-push module
vi.mock('../push/web-push.js', () => ({
  sendPush: vi.fn(),
}));

import { sendPush } from '../push/web-push.js';
const mockSendPush = vi.mocked(sendPush);

// --- shouldDispatch tests (existing) ---

describe('shouldDispatch', () => {
  it('returns true when formatted time matches settings.time exactly', () => {
    // 08:00 UTC → 15:00 in Asia/Jakarta (UTC+7)
    const now = new Date('2025-01-15T08:00:00Z');
    const settings = { time: '15:00', timezone: 'Asia/Jakarta' };
    expect(shouldDispatch(now, settings)).toBe(true);
  });

  it('returns false when formatted time does not match', () => {
    // 08:00 UTC → 15:00 in Asia/Jakarta, but settings say 08:00
    const now = new Date('2025-01-15T08:00:00Z');
    const settings = { time: '08:00', timezone: 'Asia/Jakarta' };
    expect(shouldDispatch(now, settings)).toBe(false);
  });

  it('returns true for UTC timezone when time matches', () => {
    const now = new Date('2025-06-10T14:30:00Z');
    const settings = { time: '14:30', timezone: 'UTC' };
    expect(shouldDispatch(now, settings)).toBe(true);
  });

  it('handles negative UTC offsets correctly', () => {
    // 20:00 UTC → 15:00 in America/New_York (UTC-5, EST)
    const now = new Date('2025-01-15T20:00:00Z');
    const settings = { time: '15:00', timezone: 'America/New_York' };
    expect(shouldDispatch(now, settings)).toBe(true);
  });

  it('returns false when off by one minute', () => {
    // 08:01 UTC → 15:01 in Asia/Jakarta, settings say 15:00
    const now = new Date('2025-01-15T08:01:00Z');
    const settings = { time: '15:00', timezone: 'Asia/Jakarta' };
    expect(shouldDispatch(now, settings)).toBe(false);
  });

  it('handles midnight correctly', () => {
    // 17:00 UTC → 00:00 next day in Asia/Jakarta (UTC+7)
    const now = new Date('2025-01-15T17:00:00Z');
    const settings = { time: '00:00', timezone: 'Asia/Jakarta' };
    expect(shouldDispatch(now, settings)).toBe(true);
  });
});

// --- dispatchCore tests ---

/** Helper to create a mock KV namespace. */
function createMockKV(data: Record<string, string> = {}): KVNamespace {
  const store = new Map<string, string>(Object.entries(data));

  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async (opts?: { prefix?: string; cursor?: string }) => {
      const prefix = opts?.prefix ?? '';
      const keys = Array.from(store.keys())
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name, expiration: undefined, metadata: undefined }));
      return { keys, list_complete: true, cursor: '' };
    }),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

function makeEnv(kvData: Record<string, string> = {}): Env {
  return {
    GOOGLE_CLIENT_ID: 'test-client-id',
    OWNER_EMAIL: 'owner@example.com',
    VAPID_PUBLIC_KEY: 'vapid-pub',
    VAPID_PRIVATE_KEY: 'vapid-priv',
    VAPID_SUBJECT: 'mailto:owner@example.com',
    DISPATCH_SECRET: 'test-secret',
    KV: createMockKV(kvData),
  };
}

describe('dispatchCore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early with reason no_settings when no settings exist', async () => {
    const env = makeEnv();
    const response = await dispatchCore(env, false);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, sent: 0, reason: 'no_settings' });
  });

  it('returns early with reason no_settings when isTest=true and no settings', async () => {
    const env = makeEnv();
    const response = await dispatchCore(env, true);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, sent: 0, reason: 'no_settings' });
  });

  it('returns no_subscriptions when settings exist but no subscriptions', async () => {
    const env = makeEnv({
      'settings:owner@example.com': JSON.stringify({
        time: '08:00',
        timezone: 'Asia/Jakarta',
        updatedAt: '2025-01-01T00:00:00Z',
      }),
    });

    // isTest=true to skip time check
    const response = await dispatchCore(env, true);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, sent: 0, reason: 'no_subscriptions' });
  });

  it('sends push to all subscriptions when isTest=true (skips time check)', async () => {
    const subscription = {
      endpoint: 'https://push.example.com/sub1',
      keys: { p256dh: 'key1', auth: 'auth1' },
    };

    const env = makeEnv({
      'settings:owner@example.com': JSON.stringify({
        time: '08:00',
        timezone: 'Asia/Jakarta',
        updatedAt: '2025-01-01T00:00:00Z',
      }),
      'subs:owner@example.com:hash1': JSON.stringify(subscription),
    });

    mockSendPush.mockResolvedValue({ status: 201 });

    const response = await dispatchCore(env, true);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, sent: 1, failed: 0, removed: 0 });
    expect(mockSendPush).toHaveBeenCalledWith(subscription, JSON.stringify({ type: 'reminder' }), {
      publicKey: 'vapid-pub',
      privateKey: 'vapid-priv',
      subject: 'mailto:owner@example.com',
    });
  });

  it('deletes subscription from KV when sendPush returns 404 (Requirement 6.10)', async () => {
    const subscription = {
      endpoint: 'https://push.example.com/stale',
      keys: { p256dh: 'key1', auth: 'auth1' },
    };

    const env = makeEnv({
      'settings:owner@example.com': JSON.stringify({
        time: '08:00',
        timezone: 'Asia/Jakarta',
        updatedAt: '2025-01-01T00:00:00Z',
      }),
      'subs:owner@example.com:stale-hash': JSON.stringify(subscription),
    });

    mockSendPush.mockResolvedValue({ status: 404 });

    const response = await dispatchCore(env, true);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, sent: 0, failed: 0, removed: 1 });
    expect(env.KV.delete).toHaveBeenCalledWith('subs:owner@example.com:stale-hash');
  });

  it('deletes subscription from KV when sendPush returns 410 (Requirement 6.10)', async () => {
    const subscription = {
      endpoint: 'https://push.example.com/gone',
      keys: { p256dh: 'key1', auth: 'auth1' },
    };

    const env = makeEnv({
      'settings:owner@example.com': JSON.stringify({
        time: '08:00',
        timezone: 'Asia/Jakarta',
        updatedAt: '2025-01-01T00:00:00Z',
      }),
      'subs:owner@example.com:gone-hash': JSON.stringify(subscription),
    });

    mockSendPush.mockResolvedValue({ status: 410 });

    const response = await dispatchCore(env, true);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, sent: 0, failed: 0, removed: 1 });
    expect(env.KV.delete).toHaveBeenCalledWith('subs:owner@example.com:gone-hash');
  });

  it('counts failed pushes when sendPush returns other error status', async () => {
    const subscription = {
      endpoint: 'https://push.example.com/error',
      keys: { p256dh: 'key1', auth: 'auth1' },
    };

    const env = makeEnv({
      'settings:owner@example.com': JSON.stringify({
        time: '08:00',
        timezone: 'Asia/Jakarta',
        updatedAt: '2025-01-01T00:00:00Z',
      }),
      'subs:owner@example.com:err-hash': JSON.stringify(subscription),
    });

    mockSendPush.mockResolvedValue({ status: 500 });

    const response = await dispatchCore(env, true);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, sent: 0, failed: 1, removed: 0 });
  });

  it('handles multiple subscriptions with mixed results', async () => {
    const sub1 = {
      endpoint: 'https://push.example.com/ok',
      keys: { p256dh: 'k1', auth: 'a1' },
    };
    const sub2 = {
      endpoint: 'https://push.example.com/stale',
      keys: { p256dh: 'k2', auth: 'a2' },
    };
    const sub3 = {
      endpoint: 'https://push.example.com/fail',
      keys: { p256dh: 'k3', auth: 'a3' },
    };

    const env = makeEnv({
      'settings:owner@example.com': JSON.stringify({
        time: '08:00',
        timezone: 'Asia/Jakarta',
        updatedAt: '2025-01-01T00:00:00Z',
      }),
      'subs:owner@example.com:h1': JSON.stringify(sub1),
      'subs:owner@example.com:h2': JSON.stringify(sub2),
      'subs:owner@example.com:h3': JSON.stringify(sub3),
    });

    mockSendPush
      .mockResolvedValueOnce({ status: 201 })
      .mockResolvedValueOnce({ status: 410 })
      .mockResolvedValueOnce({ status: 503 });

    const response = await dispatchCore(env, true);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, sent: 1, failed: 1, removed: 1 });
  });

  it('skips subscriptions that cannot be read from KV (null)', async () => {
    // Create env with a subscription key that exists in list but returns null on get
    const kvData = {
      'settings:owner@example.com': JSON.stringify({
        time: '08:00',
        timezone: 'Asia/Jakarta',
        updatedAt: '2025-01-01T00:00:00Z',
      }),
    };
    const env = makeEnv(kvData);

    // Override list to return a key that doesn't exist in the store
    const mockList = vi.mocked(env.KV.list);
    mockList.mockResolvedValue({
      keys: [{ name: 'subs:owner@example.com:phantom' }],
      list_complete: true,
      cursor: '',
      cacheStatus: null,
    } as unknown as KVNamespaceListResult<unknown, string>);

    const response = await dispatchCore(env, true);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, sent: 0, failed: 0, removed: 0 });
    expect(mockSendPush).not.toHaveBeenCalled();
  });
});
