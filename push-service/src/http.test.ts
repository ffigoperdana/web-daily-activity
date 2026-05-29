import { describe, it, expect } from 'vitest';
import { json, forbidden, badRequest, misconfigured } from './http';

describe('http response helpers', () => {
  describe('json()', () => {
    it('creates a response with the given status and JSON body', async () => {
      const res = json(200, { hello: 'world' });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ hello: 'world' });
    });

    it('sets Cache-Control: no-store header', () => {
      const res = json(200, {});
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    });

    it('sets Content-Type to application/json; charset=utf-8', () => {
      const res = json(200, {});
      expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    });
  });

  describe('forbidden()', () => {
    it('returns 403 with error body', async () => {
      const res = forbidden();
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'forbidden' });
    });

    it('includes Cache-Control: no-store header', () => {
      const res = forbidden();
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    });
  });

  describe('badRequest()', () => {
    it('returns 400 with error body when no message provided', async () => {
      const res = badRequest();
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'bad_request' });
    });

    it('includes message field when message is provided', async () => {
      const res = badRequest('invalid time format');
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'bad_request', message: 'invalid time format' });
    });

    it('includes Cache-Control: no-store header', () => {
      const res = badRequest();
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    });
  });

  describe('misconfigured()', () => {
    it('returns 500 with error and missing array', async () => {
      const res = misconfigured(['VAPID_PRIVATE_KEY', 'OWNER_EMAIL']);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: 'misconfigured',
        missing: ['VAPID_PRIVATE_KEY', 'OWNER_EMAIL'],
      });
    });

    it('includes Cache-Control: no-store header', () => {
      const res = misconfigured([]);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    });
  });
});
