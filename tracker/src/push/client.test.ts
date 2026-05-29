/**
 * Unit tests for the Push_Service client.
 *
 * Validates that each method calls the correct endpoint with proper
 * headers and handles responses/errors correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const MOCK_PUSH_URL = 'https://push.example.com';
const MOCK_TOKEN = 'test-id-token-123';

// Stub env before importing the module under test
vi.stubEnv('VITE_PUSH_SERVICE_URL', MOCK_PUSH_URL);

const { getSettings, postSettings, postSubscribe, deleteSubscribe, postDispatchTest } =
  await import('./client');

describe('Push_Service client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('getSettings', () => {
    it('sends GET to /settings with Bearer token', async () => {
      const mockResponse = { configured: true, time: '08:00', timezone: 'Asia/Jakarta' };
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const result = await getSettings(MOCK_TOKEN);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${MOCK_PUSH_URL}/settings`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${MOCK_TOKEN}`,
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('returns configured: false when no settings exist', async () => {
      const mockResponse = { configured: false };
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const result = await getSettings(MOCK_TOKEN);
      expect(result).toEqual({ configured: false });
    });

    it('throws on non-ok response', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response('forbidden', { status: 403, statusText: 'Forbidden' }),
      );

      await expect(getSettings(MOCK_TOKEN)).rejects.toThrow('getSettings failed: 403 Forbidden');
    });
  });

  describe('postSettings', () => {
    it('sends POST to /settings with body and Bearer token', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

      const body = { time: '09:30', timezone: 'Asia/Jakarta' };
      const result = await postSettings(MOCK_TOKEN, body);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${MOCK_PUSH_URL}/settings`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${MOCK_TOKEN}`,
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(body),
        }),
      );
      expect(result).toEqual({ ok: true });
    });

    it('throws on non-ok response', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response('bad request', { status: 400, statusText: 'Bad Request' }),
      );

      await expect(postSettings(MOCK_TOKEN, { time: 'invalid', timezone: '' })).rejects.toThrow(
        'postSettings failed: 400 Bad Request',
      );
    });
  });

  describe('postSubscribe', () => {
    it('sends POST to /subscribe with subscription JSON and Bearer token', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

      const subscription: PushSubscriptionJSON = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        expirationTime: null,
        keys: { p256dh: 'key-p256dh', auth: 'key-auth' },
      };

      const result = await postSubscribe(MOCK_TOKEN, subscription);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${MOCK_PUSH_URL}/subscribe`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${MOCK_TOKEN}`,
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(subscription),
        }),
      );
      expect(result).toEqual({ ok: true });
    });

    it('throws on non-ok response', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response('forbidden', { status: 403, statusText: 'Forbidden' }),
      );

      await expect(postSubscribe(MOCK_TOKEN, { endpoint: '', keys: null })).rejects.toThrow(
        'postSubscribe failed: 403 Forbidden',
      );
    });
  });

  describe('deleteSubscribe', () => {
    it('sends DELETE to /subscribe with endpoint in body and Bearer token', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

      const endpoint = 'https://fcm.googleapis.com/fcm/send/abc123';
      const result = await deleteSubscribe(MOCK_TOKEN, endpoint);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${MOCK_PUSH_URL}/subscribe`,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: `Bearer ${MOCK_TOKEN}`,
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ endpoint }),
        }),
      );
      expect(result).toEqual({ ok: true });
    });

    it('throws on non-ok response', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response('not found', { status: 404, statusText: 'Not Found' }),
      );

      await expect(deleteSubscribe(MOCK_TOKEN, 'https://example.com')).rejects.toThrow(
        'deleteSubscribe failed: 404 Not Found',
      );
    });
  });

  describe('postDispatchTest', () => {
    it('sends POST to /dispatch/test with Bearer token', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

      const result = await postDispatchTest(MOCK_TOKEN);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${MOCK_PUSH_URL}/dispatch/test`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${MOCK_TOKEN}`,
          }),
        }),
      );
      expect(result).toEqual({ ok: true });
    });

    it('throws on non-ok response', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response('server error', { status: 500, statusText: 'Internal Server Error' }),
      );

      await expect(postDispatchTest(MOCK_TOKEN)).rejects.toThrow(
        'postDispatchTest failed: 500 Internal Server Error',
      );
    });
  });
});
