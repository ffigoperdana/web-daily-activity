import { id } from '../i18n/id';
const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
export async function insertEvent(payload, auth) {
  let accessToken;
  try {
    accessToken = await auth.getValidAccessToken();
  } catch {
    return { ok: false, status: 0, message: id.tidak_bisa_menghubungi_calendar };
  }
  let response;
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
    const data = await response.json();
    return { ok: true, eventId: data.id ?? '' };
  }
  // Non-2xx: extract error message from response body
  let message;
  try {
    const errorBody = await response.json();
    message = errorBody?.error?.message ?? `HTTP ${response.status}`;
  } catch {
    message = `HTTP ${response.status}`;
  }
  return { ok: false, status: response.status, message };
}
//# sourceMappingURL=insert-event.js.map
