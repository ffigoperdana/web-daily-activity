/**
 * Google ID token verification for the Push_Service.
 *
 * Uses `jose` to verify tokens against Google's JWKS endpoint with
 * a 12-hour cache via `caches.default` using jose's `jwksCache` mechanism.
 */

import {
  createRemoteJWKSet,
  jwtVerify,
  jwksCache,
  type FlattenedJWSInput,
  type JWSHeaderParameters,
  type GetKeyFunction,
  type ExportedJWKSCache,
  type JWKSCacheInput,
} from 'jose';
import type { Env } from '../env.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Verified claims extracted from a Google ID token. */
export interface Claims {
  email: string;
  email_verified: boolean;
  sub: string;
}

/** HTTP-aware error with a status code. */
export class HttpError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// JWKS cache helpers
// ---------------------------------------------------------------------------

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const CACHE_KEY = 'https://push-service-internal/jwks-cache';
const CACHE_TTL_SECONDS = 12 * 60 * 60; // 12 hours

/**
 * Load a previously cached JWKS from `caches.default`.
 * Returns an empty object if nothing is cached.
 */
async function loadCachedJwks(): Promise<JWKSCacheInput> {
  const cache = (caches as unknown as { default: Cache }).default;
  const cached = await cache.match(CACHE_KEY);
  if (cached) {
    try {
      return (await cached.json()) as ExportedJWKSCache;
    } catch {
      // Corrupted cache entry — treat as empty
    }
  }
  return {} as JWKSCacheInput;
}

/**
 * Store the JWKS cache object into `caches.default` with a 12-hour TTL.
 */
async function storeCachedJwks(cacheInput: JWKSCacheInput): Promise<void> {
  const cache = (caches as unknown as { default: Cache }).default;
  const response = new Response(JSON.stringify(cacheInput), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
    },
  });
  await cache.put(CACHE_KEY, response);
}

// ---------------------------------------------------------------------------
// Token verification
// ---------------------------------------------------------------------------

/**
 * Verify a Google ID token and return the extracted claims.
 *
 * Checks:
 * - Signature against Google JWKS (RS256)
 * - `aud` matches `env.GOOGLE_CLIENT_ID`
 * - `iss` is one of the two Google issuer URLs
 * - `email` matches `env.OWNER_EMAIL` (case-insensitive)
 * - `email_verified` is `true`
 *
 * Throws `HttpError(403, 'forbidden')` on any failure.
 */
export async function verifyIdToken(
  token: string,
  env: Env,
  ctx: ExecutionContext,
): Promise<Claims> {
  try {
    // Load cached JWKS from caches.default
    const cachedJwks: JWKSCacheInput = await loadCachedJwks();
    const previousUat = (cachedJwks as ExportedJWKSCache).uat;

    const JWKS = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL), {
      [jwksCache]: cachedJwks,
    });

    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ['RS256'],
      audience: env.GOOGLE_CLIENT_ID,
      issuer: ['accounts.google.com', 'https://accounts.google.com'],
    });

    // Persist updated JWKS cache if it changed
    if ((cachedJwks as ExportedJWKSCache).uat !== previousUat) {
      ctx.waitUntil(storeCachedJwks(cachedJwks));
    }

    const email = payload.email as string | undefined;
    const emailVerified = payload.email_verified as boolean | undefined;
    const sub = payload.sub as string | undefined;

    if (!email || !sub) {
      throw new HttpError(403, 'forbidden');
    }

    if (email.toLowerCase() !== env.OWNER_EMAIL.toLowerCase()) {
      throw new HttpError(403, 'forbidden');
    }

    if (emailVerified !== true) {
      throw new HttpError(403, 'forbidden');
    }

    return { email, email_verified: emailVerified, sub };
  } catch (err) {
    if (err instanceof HttpError) {
      throw err;
    }
    // Any jose verification error (expired, bad signature, wrong aud/iss, etc.)
    throw new HttpError(403, 'forbidden');
  }
}
