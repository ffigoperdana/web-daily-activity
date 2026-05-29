/**
 * Dispatch logic for the Push_Service reminder system.
 *
 * Contains:
 * - `shouldDispatch` — pure helper that determines whether a push should fire.
 * - `dispatchCore` — orchestrates reading settings, checking time, iterating
 *   subscriptions, sending pushes, and cleaning up stale subscriptions.
 */

import { KvStore, settingsKey } from '../storage/kv.js';
import { sendPush } from '../push/web-push.js';
import { json } from '../http.js';
import type { Env } from '../env.js';
import type { PushSubscription, VapidConfig } from '../push/web-push.js';

/** Stored settings shape (mirrors settings.ts). */
interface StoredSettings {
  time: string;
  timezone: string;
  updatedAt: string;
}

/**
 * Determine whether a push notification should be dispatched right now.
 *
 * Computes the current time in the stored timezone using `Intl.DateTimeFormat`
 * and compares it to the stored reminder time. Returns `true` only on an
 * exact HH:MM match.
 *
 * This is a pure function — no side effects, no KV access.
 *
 * @param now - The current UTC instant as a Date object.
 * @param settings - The user's reminder settings containing `time` (HH:MM) and `timezone` (IANA).
 * @returns `true` if the formatted current time matches `settings.time` exactly.
 *
 * @example
 * // 08:00 UTC in Asia/Jakarta (UTC+7) is 15:00
 * shouldDispatch(new Date('2025-01-15T08:00:00Z'), { time: '15:00', timezone: 'Asia/Jakarta' })
 * // => true
 */
export function shouldDispatch(now: Date, settings: { time: string; timezone: string }): boolean {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: settings.timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);

  return formatted === settings.time;
}

/**
 * Core dispatch logic — reads settings, evaluates time, sends pushes.
 *
 * @param env - Worker environment bindings.
 * @param isTest - When true, skips the `shouldDispatch` check (always sends).
 * @returns A Response summarizing the dispatch result.
 */
export async function dispatchCore(env: Env, isTest: boolean): Promise<Response> {
  const store = new KvStore(env.KV);
  const ownerEmail = env.OWNER_EMAIL;

  // 1. Read settings
  const settings = await store.getJson<StoredSettings>(settingsKey(ownerEmail));

  // 2. If no settings exist, return early (no push to send)
  if (!settings) {
    return json(200, { ok: true, sent: 0, reason: 'no_settings' });
  }

  // 3. Check shouldDispatch (skip if isTest)
  if (!isTest) {
    const now = new Date();
    if (!shouldDispatch(now, settings)) {
      return json(200, { ok: true, sent: 0, reason: 'time_mismatch' });
    }
  }

  // 4. List all subscriptions
  const prefix = 'subs:' + ownerEmail + ':';
  const subKeys = await store.listPrefix(prefix);

  if (subKeys.length === 0) {
    return json(200, { ok: true, sent: 0, reason: 'no_subscriptions' });
  }

  // Build VAPID config
  const vapid: VapidConfig = {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  };

  // Push payload
  const payload = JSON.stringify({ type: 'reminder' });

  let sent = 0;
  let failed = 0;
  let removed = 0;

  // 5-7. For each subscription, read from KV, send push, handle stale subs
  for (const key of subKeys) {
    const subscription = await store.getJson<PushSubscription>(key);
    if (!subscription) {
      continue;
    }

    const result = await sendPush(subscription, payload, vapid);

    if (result.status >= 200 && result.status < 300) {
      sent++;
    } else if (result.status === 404 || result.status === 410) {
      // Stale subscription — delete from KV (Requirement 6.10)
      await store.delete(key);
      removed++;
    } else {
      failed++;
    }
  }

  // 8. Return summary
  return json(200, { ok: true, sent, failed, removed });
}
