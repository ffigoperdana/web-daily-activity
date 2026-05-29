/**
 * Thin wrapper over Cloudflare KV with JSON serialization and key prefixing.
 */
export class KvStore {
  constructor(private readonly kv: KVNamespace) {}

  /** Read a key and JSON-parse the value. Returns null if the key does not exist. */
  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.kv.get(key, 'text');
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  }

  /** JSON-stringify a value and write it to the given key. */
  async putJson(key: string, value: unknown): Promise<void> {
    await this.kv.put(key, JSON.stringify(value));
  }

  /** Delete a key from the store. */
  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }

  /** List all keys with the given prefix. Returns an array of key names. */
  async listPrefix(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor: string | null = null;
    let complete = false;

    while (!complete) {
      const opts: KVNamespaceListOptions = { prefix };
      if (cursor) {
        opts.cursor = cursor;
      }
      const result = await this.kv.list(opts);
      for (const key of result.keys) {
        keys.push(key.name);
      }
      if (result.list_complete) {
        complete = true;
      } else {
        cursor = result.cursor;
      }
    }

    return keys;
  }
}

// --- Key builder functions ---

/** Build the KV key for a subscription entry. */
export function subsKey(ownerEmail: string, endpointHash: string): string {
  return `subs:${ownerEmail}:${endpointHash}`;
}

/** Build the KV key for a user's reminder settings. */
export function settingsKey(ownerEmail: string): string {
  return `settings:${ownerEmail}`;
}

// --- Endpoint hashing ---

/** Compute a hex-encoded SHA-256 hash of a subscription endpoint URL. */
export async function endpointHash(endpoint: string): Promise<string> {
  const data = new TextEncoder().encode(endpoint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
