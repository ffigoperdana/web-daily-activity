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

/**
 * Route incoming HTTP requests to the appropriate handler.
 */
async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

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
    // Validate environment on first request after cold start
    if (!envChecked) {
      try {
        assertEnv(env);
        envChecked = true;
      } catch (err) {
        if (err instanceof EnvError) {
          console.error('Push_Service misconfigured. Missing:', err.missing);
          return misconfigured(err.missing);
        }
        throw err;
      }
    }

    try {
      return await handleRequest(request, env as Env, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return json(err.status, { error: err.message });
      }
      throw err;
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await dispatchCore(env, false);
  },
};
