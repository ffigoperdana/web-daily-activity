/**
 * GET /settings and POST /settings handlers for the Push_Service.
 *
 * GET: Returns the current reminder settings or { configured: false }.
 * POST: Validates and persists reminder time + timezone.
 */

import { KvStore, settingsKey } from '../storage/kv.js';
import { json, badRequest } from '../http.js';

/** Stored settings shape in KV. */
interface StoredSettings {
  time: string;
  timezone: string;
  updatedAt: string;
}

/** Regex for HH:MM format (00-23:00-59). */
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * GET /settings handler.
 *
 * Reads the reminder settings for the authenticated owner.
 * Returns { configured: false } if no settings exist,
 * or { configured: true, time, timezone } if they do.
 */
export async function getSettings(store: KvStore, ownerEmail: string): Promise<Response> {
  const settings = await store.getJson<StoredSettings>(settingsKey(ownerEmail));

  if (!settings) {
    return json(200, { configured: false });
  }

  return json(200, {
    configured: true,
    time: settings.time,
    timezone: settings.timezone,
  });
}

/**
 * POST /settings handler.
 *
 * Parses and validates { time, timezone } from the request body,
 * then persists the settings to KV.
 */
export async function postSettings(
  request: Request,
  store: KvStore,
  ownerEmail: string,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('invalid JSON body');
  }

  if (!body || typeof body !== 'object') {
    return badRequest('body must be an object');
  }

  const { time, timezone } = body as { time?: unknown; timezone?: unknown };

  // Validate time matches HH:MM format (00-23:00-59)
  if (typeof time !== 'string' || !TIME_RE.test(time)) {
    return badRequest('time must be in HH:MM format (00-23:00-59)');
  }

  // Validate timezone is a non-empty string
  if (typeof timezone !== 'string' || timezone.trim() === '') {
    return badRequest('timezone must be a non-empty string');
  }

  const settings: StoredSettings = {
    time,
    timezone,
    updatedAt: new Date().toISOString(),
  };

  await store.putJson(settingsKey(ownerEmail), settings);

  return json(200, { ok: true });
}
