import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireOwnerAuth } from './middleware.js';
import type { Env } from '../env.js';
import type { Claims } from './auth.js';

// Mock the auth module
vi.mock('./auth.js', () => {
  const HttpError = class HttpError extends Error {
    public readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'HttpError';
      this.status = status;
    }
  };
  return {
    HttpError,
    verifyIdToken: vi.fn(),
  };
});

import { verifyIdToken, HttpError } from './auth.js';

const mockVerifyIdToken = vi.mocked(verifyIdToken);

function makeEnv(): Env {
  return {
    GOOGLE_CLIENT_ID: 'test-client-id',
    OWNER_EMAIL: 'owner@example.com',
    VAPID_PUBLIC_KEY: 'vapid-pub',
    VAPID_PRIVATE_KEY: 'vapid-priv',
    VAPID_SUBJECT: 'mailto:owner@example.com',
    DISPATCH_SECRET: 'secret',
    KV: {} as KVNamespace,
  };
}

function makeCtx(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  } as unknown as ExecutionContext;
}

describe('requireOwnerAuth', () => {
  let env: Env;
  let ctx: ExecutionContext;

  beforeEach(() => {
    env = makeEnv();
    ctx = makeCtx();
    vi.clearAllMocks();
  });

  it('returns 403 when Authorization header is missing', async () => {
    const request = new Request('https://example.com/subscribe', {
      method: 'POST',
    });

    const result = await requireOwnerAuth(request, env, ctx);

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ error: 'forbidden' });
  });

  it('returns 403 when Authorization header does not start with Bearer', async () => {
    const request = new Request('https://example.com/subscribe', {
      method: 'POST',
      headers: { Authorization: 'Basic abc123' },
    });

    const result = await requireOwnerAuth(request, env, ctx);

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(403);
  });

  it('returns 403 when Bearer token is empty', async () => {
    const request = new Request('https://example.com/subscribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' },
    });

    const result = await requireOwnerAuth(request, env, ctx);

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(403);
  });

  it('returns 403 when verifyIdToken throws HttpError', async () => {
    mockVerifyIdToken.mockRejectedValue(new HttpError(403, 'forbidden'));

    const request = new Request('https://example.com/subscribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid-token' },
    });

    const result = await requireOwnerAuth(request, env, ctx);

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(403);
  });

  it('returns 403 when verifyIdToken throws a generic error', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('network failure'));

    const request = new Request('https://example.com/subscribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer some-token' },
    });

    const result = await requireOwnerAuth(request, env, ctx);

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(403);
  });

  it('returns { ok: true, claims } when verification succeeds', async () => {
    const claims: Claims = {
      email: 'owner@example.com',
      email_verified: true,
      sub: '12345',
    };
    mockVerifyIdToken.mockResolvedValue(claims);

    const request = new Request('https://example.com/subscribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    });

    const result = await requireOwnerAuth(request, env, ctx);

    expect(result).not.toBeInstanceOf(Response);
    expect(result).toEqual({ ok: true, claims });
  });

  it('passes the correct token to verifyIdToken', async () => {
    const claims: Claims = {
      email: 'owner@example.com',
      email_verified: true,
      sub: '12345',
    };
    mockVerifyIdToken.mockResolvedValue(claims);

    const request = new Request('https://example.com/subscribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer my-specific-token' },
    });

    await requireOwnerAuth(request, env, ctx);

    expect(mockVerifyIdToken).toHaveBeenCalledWith('my-specific-token', env, ctx);
  });
});
