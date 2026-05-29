import { describe, it, expect, beforeEach } from 'vitest';
import { handlePostSubscribe, handleDeleteSubscribe } from './subscribe';
import { KvStore, subsKey, endpointHash } from '../storage/kv';
import { env } from 'cloudflare:test';

describe('subscribe handlers', () => {
  let store: KvStore;
  const ownerEmail = 'owner@example.com';

  beforeEach(() => {
    store = new KvStore(env.KV);
  });

  describe('handlePostSubscribe', () => {
    it('stores a valid subscription and returns 200 { ok: true }', async () => {
      const body = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        expirationTime: null,
        keys: { p256dh: 'publicKey123', auth: 'authSecret456' },
      };

      const request = new Request('https://example.com/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TestBrowser/1.0',
        },
        body: JSON.stringify(body),
      });

      const response = await handlePostSubscribe(request, store, ownerEmail);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });

      // Verify stored in KV
      const hash = await endpointHash(body.endpoint);
      const key = subsKey(ownerEmail, hash);
      const stored = await store.getJson<Record<string, unknown>>(key);
      expect(stored).not.toBeNull();
      expect(stored!.endpoint).toBe(body.endpoint);
      expect(stored!.expirationTime).toBeNull();
      expect(stored!.keys).toEqual(body.keys);
      expect(stored!.userAgent).toBe('TestBrowser/1.0');
      expect(stored!.createdAt).toBeDefined();
    });

    it('overwrites existing subscription with same endpoint (idempotent)', async () => {
      const endpoint = 'https://fcm.googleapis.com/fcm/send/same-endpoint';
      const body1 = {
        endpoint,
        expirationTime: null,
        keys: { p256dh: 'key1', auth: 'auth1' },
      };
      const body2 = {
        endpoint,
        expirationTime: 1234567890,
        keys: { p256dh: 'key2', auth: 'auth2' },
      };

      const req1 = new Request('https://example.com/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body1),
      });
      await handlePostSubscribe(req1, store, ownerEmail);

      const req2 = new Request('https://example.com/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body2),
      });
      await handlePostSubscribe(req2, store, ownerEmail);

      // Verify only the latest value is stored
      const hash = await endpointHash(endpoint);
      const key = subsKey(ownerEmail, hash);
      const stored = await store.getJson<Record<string, unknown>>(key);
      expect(stored!.keys).toEqual(body2.keys);
      expect(stored!.expirationTime).toBe(1234567890);
    });

    it('returns 400 for invalid JSON body', async () => {
      const request = new Request('https://example.com/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      });

      const response = await handlePostSubscribe(request, store, ownerEmail);
      expect(response.status).toBe(400);
    });

    it('returns 400 when endpoint is missing', async () => {
      const request = new Request('https://example.com/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: { p256dh: 'a', auth: 'b' } }),
      });

      const response = await handlePostSubscribe(request, store, ownerEmail);
      expect(response.status).toBe(400);
    });

    it('returns 400 when keys are missing', async () => {
      const request = new Request('https://example.com/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'https://push.example.com/abc' }),
      });

      const response = await handlePostSubscribe(request, store, ownerEmail);
      expect(response.status).toBe(400);
    });

    it('returns 400 when expirationTime is not a number or null', async () => {
      const request = new Request('https://example.com/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'https://push.example.com/abc',
          expirationTime: 'invalid',
          keys: { p256dh: 'a', auth: 'b' },
        }),
      });

      const response = await handlePostSubscribe(request, store, ownerEmail);
      expect(response.status).toBe(400);
    });
  });

  describe('handleDeleteSubscribe', () => {
    it('deletes an existing subscription and returns 200 { ok: true }', async () => {
      const endpoint = 'https://fcm.googleapis.com/fcm/send/to-delete';
      const hash = await endpointHash(endpoint);
      const key = subsKey(ownerEmail, hash);

      // Pre-populate KV
      await store.putJson(key, {
        endpoint,
        expirationTime: null,
        keys: { p256dh: 'x', auth: 'y' },
        userAgent: null,
        createdAt: '2025-01-01T00:00:00.000Z',
      });

      const request = new Request('https://example.com/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });

      const response = await handleDeleteSubscribe(request, store, ownerEmail);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });

      // Verify deleted from KV
      const stored = await store.getJson(key);
      expect(stored).toBeNull();
    });

    it('returns 200 even if endpoint does not exist (no-op)', async () => {
      const request = new Request('https://example.com/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'https://nonexistent.example.com/push' }),
      });

      const response = await handleDeleteSubscribe(request, store, ownerEmail);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
    });

    it('returns 400 for invalid JSON body', async () => {
      const request = new Request('https://example.com/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      });

      const response = await handleDeleteSubscribe(request, store, ownerEmail);
      expect(response.status).toBe(400);
    });

    it('returns 400 when endpoint is missing', async () => {
      const request = new Request('https://example.com/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await handleDeleteSubscribe(request, store, ownerEmail);
      expect(response.status).toBe(400);
    });
  });
});
