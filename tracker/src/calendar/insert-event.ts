import type { CalendarEvent } from './types';
import { id } from '../i18n/id';

export type InsertEventResult =
  | { ok: true; eventId: string }
  | { ok: false; status: number; message: string };

const CALENDAR_API_URL =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export async function insertEvent(
  payload: CalendarEvent,
  auth: { getValidAccessToken: () => Promise<string> },
): Promise<InsertEventResult> {
  let accessToken: string;
  try {
    accessToken = await auth.getValidAccessToken();
  } catch {
    return { ok: false, status: 0, message: id.tidak_bisa_menghubungi_calendar };
  }

  let response: Response;
  try {
    response = await fetch(CALENDAR_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, status: 0, message: id.tidak_bisa_menghubungi_calendar };
  }

  // On 401: refresh token and retry exactly once
  if (response.status === 401) {
    try {
      accessToken = await auth.getValidAccessToken();
    } catch {
      return { ok: false, status: 0, message: id.tidak_bisa_menghubungi_calendar };
    }

    try {
      response = await fetch(CALENDAR_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return { ok: false, status: 0, message: id.tidak_bisa_menghubungi_calendar };
    }
  }

  // Handle final response
  if (response.status >= 200 && response.status < 300) {
    const data = (await response.json()) as { id?: string };
    return { ok: true, eventId: data.id ?? '' };
  }

  // Non-2xx: extract error message from response body
  let message: string;
  try {
    const errorBody = (await response.json()) as {
      error?: { message?: string };
    };
    message = errorBody?.error?.message ?? `HTTP ${response.status}`;
  } catch {
    message = `HTTP ${response.status}`;
  }

  return { ok: false, status: response.status, message };
}
