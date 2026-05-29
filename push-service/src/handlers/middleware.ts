/**
 * Authentication middleware for the Push_Service.
 *
 * Extracts and verifies the Bearer token from the Authorization header,
 * returning verified claims on success or a 403 response on failure.
 * No KV mutation occurs in this middleware.
 */

import type { Env } from '../env.js';
import { type Claims, verifyIdToken, HttpError } from './auth.js';
import { forbidden } from '../http.js';

/**
 * Validates the `Authorization: Bearer <id_token>` header and verifies
 * the token against Google's JWKS.
 *
 * @returns `{ ok: true, claims }` on success, or a `403` Response on failure.
 */
export async function requireOwnerAuth(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<{ ok: true; claims: Claims } | Response> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return forbidden();
  }

  const token = authHeader.slice('Bearer '.length);

  if (!token) {
    return forbidden();
  }

  try {
    const claims = await verifyIdToken(token, env, ctx);
    return { ok: true, claims };
  } catch (err) {
    if (err instanceof HttpError) {
      return forbidden();
    }
    return forbidden();
  }
}
