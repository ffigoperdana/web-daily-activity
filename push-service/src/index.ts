import { assertEnv, EnvError } from './env';
import { json, forbidden, badRequest, misconfigured } from './http';
import { requireOwnerAuth } from './handlers/middleware';
import { HttpError } from './handlers/auth';
import { handlePostSubscribe, handleDeleteSubscribe } from './handlers/subscribe';
import { getSettings, postSettings } from './handlers/settings';
import { dispatchCore } from './handlers/dispatch';
import { KvStore } from './storage/kv';

import type { Env } from './env';

/** Module-scope flag: once assertEnv succeeds, skip on subsequent requests. */
let envChecked = false;

/** Allowed origins for CORS. */
const ALLOWED_ORIGINS = [
  'https://daily.fgdev.tech',
  'http://localhost:5173',
  'http://localhost:4173',
];

/** Add CORS headers to a response. */
function withCors(response: Response, origin: string | null): Response {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]!;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Dispatch-Secret');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Route incoming HTTP requests to the appropriate handler.
 */
async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  // Health check
  if (method === 'GET' && pathname === '/') {
    return json(200, { status: 'ok' });
  }

  // Subscription management
  if (pathname === '/subscribe') {
    const authResult = await requireOwnerAuth(request, env, ctx);
    if (authResult instanceof Response) return authResult;
    const store = new KvStore(env.KV);

    if (method === 'POST') {
      return handlePostSubscribe(request, store, authResult.claims.email);
    }
    if (method === 'DELETE') {
      return handleDeleteSubscribe(request, store, authResult.claims.email);
    }
  }

  // Settings
  if (pathname === '/settings') {
    const authResult = await requireOwnerAuth(request, env, ctx);
    if (authResult instanceof Response) return authResult;
    const store = new KvStore(env.KV);

    if (method === 'GET') {
      return getSettings(store, authResult.claims.email);
    }
    if (method === 'POST') {
      return postSettings(request, store, authResult.claims.email);
    }
  }

  // Dispatch (cron-driven) — requires X-Dispatch-Secret header (Requirement 7.5, 7.6)
  if (pathname === '/dispatch' && method === 'POST') {
    const secret = request.headers.get('X-Dispatch-Secret');
    if (!secret || secret !== env.DISPATCH_SECRET) {
      return forbidden();
    }
    return dispatchCore(env, false);
  }

  // Test dispatch (force push to all subscriptions) — requires owner auth
  if (pathname === '/dispatch/test' && method === 'POST') {
    const authResult = await requireOwnerAuth(request, env, ctx);
    if (authResult instanceof Response) return authResult;
    return dispatchCore(env, true);
  }

  return json(404, { error: 'not_found' });
}

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin');

    // Validate environment on first request after cold start
    if (!envChecked) {
      try {
        assertEnv(env);
        envChecked = true;
      } catch (err) {
        if (err instanceof EnvError) {
          console.error('Push_Service misconfigured. Missing:', err.missing);
          return withCors(misconfigured(err.missing), origin);
        }
        throw err;
      }
    }

    // Handle CORS preflight early
    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), origin);
    }

    try {
      const response = await handleRequest(request, env as Env, ctx);
      return withCors(response, origin);
    } catch (err) {
      if (err instanceof HttpError) {
        return withCors(json(err.status, { error: err.message }), origin);
      }
      throw err;
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await dispatchCore(env, false);
  },
};
