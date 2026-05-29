import { describe, it, expect, vi, beforeEach } from 'vitest';
import { insertEvent } from './insert-event';
import type { CalendarEvent } from './types';

const samplePayload: CalendarEvent = {
  summary: 'Test activity',
  start: { date: '2025-01-15' },
  end: { date: '2025-01-16' },
};

function mockAuth(token = 'access-token-1') {
  return { getValidAccessToken: vi.fn().mockResolvedValue(token) };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('insertEvent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok with eventId on 200', async () => {
    const auth = mockAuth();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { id: 'evt_123' })));

    const result = await insertEvent(samplePayload, auth);

    expect(result).toEqual({ ok: true, eventId: 'evt_123' });
    expect(auth.getValidAccessToken).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries exactly once on 401 and succeeds', async () => {
    const auth = {
      getValidAccessToken: vi
        .fn()
        .mockResolvedValueOnce('token-1')
        .mockResolvedValueOnce('token-2'),
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(401, {}))
        .mockResolvedValueOnce(jsonResponse(200, { id: 'evt_456' })),
    );

    const result = await insertEvent(samplePayload, auth);

    expect(result).toEqual({ ok: true, eventId: 'evt_456' });
    expect(auth.getValidAccessToken).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries on 401 and returns error if retry also fails', async () => {
    const auth = {
      getValidAccessToken: vi
        .fn()
        .mockResolvedValueOnce('token-1')
        .mockResolvedValueOnce('token-2'),
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(401, {}))
        .mockResolvedValueOnce(jsonResponse(403, { error: { message: 'Forbidden' } })),
    );

    const result = await insertEvent(samplePayload, auth);

    expect(result).toEqual({ ok: false, status: 403, message: 'Forbidden' });
    expect(auth.getValidAccessToken).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry on non-401 errors', async () => {
    const auth = mockAuth();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(500, { error: { message: 'Internal error' } })),
    );

    const result = await insertEvent(samplePayload, auth);

    expect(result).toEqual({
      ok: false,
      status: 500,
      message: 'Internal error',
    });
    expect(auth.getValidAccessToken).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns network error message on fetch rejection', async () => {
    const auth = mockAuth();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const result = await insertEvent(samplePayload, auth);

    expect(result).toEqual({
      ok: false,
      status: 0,
      message: 'tidak bisa menghubungi Google Calendar',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('sends correct Authorization header and JSON body', async () => {
    const auth = mockAuth('my-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { id: 'evt_789' })));

    await insertEvent(samplePayload, auth);

    expect(fetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer my-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(samplePayload),
      },
    );
  });

  it('falls back to HTTP status message when error body is not parseable', async () => {
    const auth = mockAuth();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('not json', {
          status: 502,
          headers: { 'Content-Type': 'text/plain' },
        }),
      ),
    );

    const result = await insertEvent(samplePayload, auth);

    expect(result).toEqual({ ok: false, status: 502, message: 'HTTP 502' });
  });

  it('handles getValidAccessToken rejection on initial call', async () => {
    const auth = {
      getValidAccessToken: vi.fn().mockRejectedValue(new Error('no token')),
    };

    const result = await insertEvent(samplePayload, auth);

    expect(result).toEqual({
      ok: false,
      status: 0,
      message: 'tidak bisa menghubungi Google Calendar',
    });
  });
});
