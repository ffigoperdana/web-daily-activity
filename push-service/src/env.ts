/**
 * Push_Service environment configuration.
 *
 * Lists every required env var / binding and exports:
 * - `Env` — the fully-typed environment interface
 * - `EnvError` — thrown when required vars are missing/empty
 * - `assertEnv` — type-assertion guard that validates the env on cold start
 */

/** Required string environment variable names. */
const REQUIRED_VARS = [
  'GOOGLE_CLIENT_ID',
  'OWNER_EMAIL',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'DISPATCH_SECRET',
] as const;

/** Required binding names (non-string). */
const REQUIRED_BINDINGS = ['KV'] as const;

/**
 * Fully-typed Worker environment.
 */
export interface Env {
  GOOGLE_CLIENT_ID: string;
  OWNER_EMAIL: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  DISPATCH_SECRET: string;
  KV: KVNamespace;
}

/**
 * Error thrown by `assertEnv` when one or more required env vars/bindings
 * are missing or empty.
 */
export class EnvError extends Error {
  public readonly missing: string[];

  constructor(missing: string[]) {
    super(`Missing environment variables: ${missing.join(', ')}`);
    this.name = 'EnvError';
    this.missing = missing;
  }
}

/**
 * Validates that every required environment variable and binding is present
 * and non-empty. Throws `EnvError` listing all absent names.
 */
export function assertEnv(env: unknown): asserts env is Env {
  const missing: string[] = [];
  const record = env as Record<string, unknown> | null | undefined;

  if (!record || typeof record !== 'object') {
    throw new EnvError([...REQUIRED_VARS, ...REQUIRED_BINDINGS]);
  }

  for (const name of REQUIRED_VARS) {
    const value = record[name];
    if (typeof value !== 'string' || value.trim() === '') {
      missing.push(name);
    }
  }

  for (const name of REQUIRED_BINDINGS) {
    const value = record[name];
    if (value == null || typeof value !== 'object') {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    throw new EnvError(missing);
  }
}
