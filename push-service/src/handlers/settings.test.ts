import { describe, it, expect, beforeEach } from 'vitest';
import { getSettings, postSettings } from './settings';
import { KvStore, settingsKey } from '../storage/kv';

/**
 * In-memory KVNamespace mock for unit testing.
 */
function createMockKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({ keys: [], list_complete: true, cursor: '' }),
    getWithMetadata: async () => ({ value: null, metadata: null }),
  } as unknown as KVNamespace;
}

describe('settings handlers', () => {
  let store: KvStore;
  let mockKv: KVNamespace;
  const ownerEmail = 'owner@example.com';

  beforeEach(() => {
    mockKv = createMockKv();
    store = new KvStore(mockKv);
  });

  describe('GET /settings (getSettings)', () => {
    it('returns { configured: false } when no settings exist', async () => {
      const res = await getSettings(store, ownerEmail);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ configured: false });
    });

    it('returns { configured: true, time, timezone } when settings exist', async () => {
      await store.putJson(settingsKey(ownerEmail), {
        time: '08:00',
        timezone: 'Asia/Jakarta',
        updatedAt: '2025-01-01T00:00:00.000Z',
      });

      const res = await getSettings(store, ownerEmail);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        configured: true,
        time: '08:00',
        timezone: 'Asia/Jakarta',
      });
    });

    it('does not leak updatedAt in the response', async () => {
      await store.putJson(settingsKey(ownerEmail), {
        time: '14:30',
        timezone: 'America/New_York',
        updatedAt: '2025-06-01T12:00:00.000Z',
      });

      const res = await getSettings(store, ownerEmail);
      const body = await res.json();
      expect(body).not.toHaveProperty('updatedAt');
    });
  });

  describe('POST /settings (postSettings)', () => {
    it('stores valid settings and returns { ok: true }', async () => {
      const request = new Request('http://localhost/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: '08:00', timezone: 'Asia/Jakarta' }),
      });

      const res = await postSettings(request, store, ownerEmail);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });

      // Verify stored value
      const stored = await store.getJson<{ time: string; timezone: string; updatedAt: string }>(
        settingsKey(ownerEmail),
      );
      expect(stored).not.toBeNull();
      expect(stored!.time).toBe('08:00');
      expect(stored!.timezone).toBe('Asia/Jakarta');
      expect(stored!.updatedAt).toBeDefined();
    });

    it('rejects invalid time format (missing leading zero)', async () => {
      const request = new Request('http://localhost/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: '8:00', timezone: 'Asia/Jakarta' }),
      });

      const res = await postSettings(request, store, ownerEmail);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('bad_request');
    });

    it('rejects time with hour > 23', async () => {
      const request = new Request('http://localhost/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: '24:00', timezone: 'Asia/Jakarta' }),
      });

      const res = await postSettings(request, store, ownerEmail);
      expect(res.status).toBe(400);
    });

    it('rejects time with minute > 59', async () => {
      const request = new Request('http://localhost/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: '08:60', timezone: 'Asia/Jakarta' }),
      });

      const res = await postSettings(request, store, ownerEmail);
      expect(res.status).toBe(400);
    });

    it('rejects empty timezone', async () => {
      const request = new Request('http://localhost/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: '08:00', timezone: '' }),
      });

      const res = await postSettings(request, store, ownerEmail);
      expect(res.status).toBe(400);
    });

    it('rejects whitespace-only timezone', async () => {
      const request = new Request('http://localhost/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: '08:00', timezone: '   ' }),
      });

      const res = await postSettings(request, store, ownerEmail);
      expect(res.status).toBe(400);
    });

    it('rejects non-string timezone', async () => {
      const request = new Request('http://localhost/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: '08:00', timezone: 123 }),
      });

      const res = await postSettings(request, store, ownerEmail);
      expect(res.status).toBe(400);
    });

    it('rejects invalid JSON body', async () => {
      const request = new Request('http://localhost/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      });

      const res = await postSettings(request, store, ownerEmail);
      expect(res.status).toBe(400);
    });

    it('accepts boundary time values (00:00 and 23:59)', async () => {
      const req1 = new Request('http://localhost/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: '00:00', timezone: 'UTC' }),
      });
      expect((await postSettings(req1, store, ownerEmail)).status).toBe(200);

      const req2 = new Request('http://localhost/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: '23:59', timezone: 'UTC' }),
      });
      expect((await postSettings(req2, store, ownerEmail)).status).toBe(200);
    });
  });
});
