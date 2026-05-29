/**
 * VAPID-signed Web Push sender using @block65/webcrypto-web-push.
 *
 * Wraps the library's `buildPushPayload` and `fetch` into a single
 * `sendPush` call suitable for Cloudflare Workers (WebCrypto-based).
 */

import { buildPushPayload } from '@block65/webcrypto-web-push';

/** Minimal push subscription shape stored in KV. */
export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/** VAPID configuration sourced from environment variables. */
export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/**
 * Send a push notification to a single subscription.
 *
 * @param subscription - The push subscription (endpoint + keys).
 * @param payload - The notification payload string (JSON-serialized by caller).
 * @param vapid - VAPID signing credentials from env vars.
 * @returns `{ status }` — the HTTP status from the push gateway, or `0` on network error.
 */
export async function sendPush(
  subscription: PushSubscription,
  payload: string,
  vapid: VapidConfig,
): Promise<{ status: number }> {
  // Adapt our types to the library's expected shapes.
  const libSubscription = {
    endpoint: subscription.endpoint,
    expirationTime: null,
    keys: subscription.keys,
  };

  const libVapid = {
    subject: vapid.subject,
    publicKey: vapid.publicKey,
    privateKey: vapid.privateKey,
  };

  try {
    const requestInit = await buildPushPayload(
      { data: payload, options: { ttl: 60, urgency: 'high' } },
      libSubscription,
      libVapid,
    );

    // Strip undefined header values and ensure body is a plain ArrayBuffer
    // to satisfy Cloudflare Workers' strict RequestInit types.
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(requestInit.headers)) {
      if (value !== undefined) {
        headers[key] = value;
      }
    }

    const response = await fetch(subscription.endpoint, {
      method: requestInit.method,
      headers,
      body: new Uint8Array(requestInit.body).buffer as ArrayBuffer,
    });
    return { status: response.status };
  } catch {
    // Network error (fetch rejection) — return status 0.
    return { status: 0 };
  }
}
