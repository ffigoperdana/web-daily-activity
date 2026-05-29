/**
 * POST /subscribe and DELETE /subscribe handlers.
 *
 * POST persists a Web Push subscription keyed by SHA-256 hash of the endpoint URL.
 * Overwrites if the same endpoint already exists (idempotent per Requirement 5.6).
 *
 * DELETE removes a subscription by endpoint hash.
 *
 * Both handlers receive the verified ownerEmail from the auth middleware.
 */

import { json, badRequest } from '../http.js';
import { KvStore, subsKey, endpointHash } from '../storage/kv.js';

/** Shape of the POST /subscribe request body. */
interface SubscribeBody {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/** Shape of the DELETE /subscribe request body. */
interface UnsubscribeBody {
  endpoint: string;
}

/**
 * Handle POST /subscribe.
 *
 * Persists the subscription to KV, keyed by ownerEmail + SHA-256(endpoint).
 * Idempotent: re-posting the same endpoint overwrites the existing entry.
 */
export async function handlePostSubscribe(
  request: Request,
  store: KvStore,
  ownerEmail: string,
): Promise<Response> {
  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return badRequest('invalid JSON body');
  }

  // Validate required fields
  if (
    typeof body.endpoint !== 'string' ||
    !body.endpoint ||
    typeof body.keys !== 'object' ||
    body.keys === null ||
    typeof body.keys.p256dh !== 'string' ||
    !body.keys.p256dh ||
    typeof body.keys.auth !== 'string' ||
    !body.keys.auth
  ) {
    return badRequest('missing required subscription fields');
  }

  if (
    body.expirationTime !== null &&
    typeof body.expirationTime !== 'number'
  ) {
    return badRequest('expirationTime must be a number or null');
  }

  const hash = await endpointHash(body.endpoint);
  const key = subsKey(ownerEmail, hash);

  await store.putJson(key, {
    endpoint: body.endpoint,
    expirationTime: body.expirationTime ?? null,
    keys: body.keys,
    userAgent: request.headers.get('user-agent'),
    createdAt: new Date().toISOString(),
  });

  return json(200, { ok: true });
}

/**
 * Handle DELETE /subscribe.
 *
 * Removes the subscription identified by the endpoint URL hash.
 */
export async function handleDeleteSubscribe(
  request: Request,
  store: KvStore,
  ownerEmail: string,
): Promise<Response> {
  let body: UnsubscribeBody;
  try {
    body = (await request.json()) as UnsubscribeBody;
  } catch {
    return badRequest('invalid JSON body');
  }

  if (typeof body.endpoint !== 'string' || !body.endpoint) {
    return badRequest('missing endpoint field');
  }

  const hash = await endpointHash(body.endpoint);
  const key = subsKey(ownerEmail, hash);

  await store.delete(key);

  return json(200, { ok: true });
}
