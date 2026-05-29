/// <reference lib="webworker" />

export type {};

declare const self: ServiceWorkerGlobalScope;

/**
 * The precache manifest injected by vite-plugin-pwa (injectManifest mode).
 * Each entry has a `url` and an optional `revision` string.
 */
const manifest = self.__WB_MANIFEST;

/**
 * Derive a stable cache name from the manifest entries.
 * We hash the sorted url+revision pairs to produce a build-unique key.
 */
function deriveCacheName(entries: Array<{ url: string; revision: string | null }>): string {
  const fingerprint = entries
    .map((e) => `${e.url}:${e.revision ?? ''}`)
    .sort()
    .join('|');
  // Simple string hash (djb2) — fast and sufficient for cache key uniqueness.
  let hash = 5381;
  for (let i = 0; i < fingerprint.length; i++) {
    hash = ((hash << 5) + hash + fingerprint.charCodeAt(i)) >>> 0;
  }
  return `dat-precache-${hash.toString(36)}`;
}

const CACHE_NAME = deriveCacheName(manifest);

/**
 * Build a set of URLs that should be in the precache for fast lookup.
 */
function buildPrecacheUrls(entries: Array<{ url: string; revision: string | null }>): Set<string> {
  const urls = new Set<string>();
  for (const entry of entries) {
    // Normalize to absolute URL based on SW scope
    const url = new URL(entry.url, self.location.href).href;
    urls.add(url);
  }
  return urls;
}

const PRECACHE_URLS = buildPrecacheUrls(manifest);

// ---------------------------------------------------------------------------
// Install: precache all manifest assets into the build-hash-keyed cache
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Fetch and cache all manifest entries
      const requests = manifest.map((entry) => {
        const url = entry.revision ? `${entry.url}?__WB_REVISION__=${entry.revision}` : entry.url;
        return new Request(url, { cache: 'reload' });
      });
      // Cache with the canonical URL (without revision query param)
      await Promise.all(
        manifest.map(async (entry, i) => {
          const req = requests[i];
          if (!req) return;
          const response = await fetch(req);
          if (response.ok) {
            const canonicalUrl = new URL(entry.url, self.location.href).href;
            await cache.put(canonicalUrl, response);
          }
        }),
      );
      // Activate immediately without waiting for existing clients to close
      await self.skipWaiting();
    })(),
  );
});

// ---------------------------------------------------------------------------
// Activate: delete old caches that don't match the current build hash
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('dat-precache-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      // Take control of all open clients immediately
      await self.clients.claim();
    })(),
  );
});

// ---------------------------------------------------------------------------
// Fetch: cache-first for precached assets, navigation fallback, offline 503
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (e.g. Google APIs, analytics)
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(handleFetch(request));
});

async function handleFetch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const requestUrl = url.href;

  // Check if this is a navigation request (HTML page load)
  const isNavigation = request.mode === 'navigate';

  // Try cache first for precached assets
  if (PRECACHE_URLS.has(requestUrl) || isNavigation) {
    const cache = await caches.open(CACHE_NAME);

    if (isNavigation) {
      // Navigation requests: try network first, fall back to cached index.html
      // Actually per task spec: navigation requests fall back to cached index.html
      // This means: serve from cache (index.html) for navigation
      const indexUrl = new URL('/index.html', self.location.href).href;
      const cachedIndex = await cache.match(indexUrl);
      if (cachedIndex) {
        return cachedIndex;
      }
      // If index.html not in cache, try network
      try {
        const response = await fetch(request);
        return response;
      } catch {
        return offlineResponse();
      }
    }

    // Cache-first for precached assets
    const cached = await cache.match(requestUrl);
    if (cached) {
      return cached;
    }

    // Asset is in the precache list but not found in cache — try network
    try {
      const response = await fetch(request);
      if (response.ok) {
        // Update cache with fresh response
        const responseClone = response.clone();
        await cache.put(requestUrl, responseClone);
      }
      return response;
    } catch {
      // Offline and not in cache: return synthetic 503
      return offlineResponse();
    }
  }

  // Non-precached same-origin requests: network only
  try {
    return await fetch(request);
  } catch {
    return offlineResponse();
  }
}

/**
 * Synthetic offline fallback response per requirement 4.5.
 */
function offlineResponse(): Response {
  return new Response('aset tidak tersedia saat offline', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-DAT-Offline': '1',
    },
  });
}

// ---------------------------------------------------------------------------
// Push: show daily reminder notification
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  // Parse payload defensively — empty, malformed JSON, or arbitrary JSON are all OK.
  // The handler MUST NOT throw regardless of payload content.
  try {
    event.data?.json();
  } catch {
    // Ignore parse errors — we don't use the payload content.
  }

  const body = `${new Date().toLocaleDateString('id-ID')} — Belum dicatat — ketuk untuk membuka`;

  event.waitUntil(
    self.registration.showNotification('Catat Aktivitas Hari Ini', {
      body,
      tag: 'daily-reminder',
      renotify: true,
      data: { route: '/?route=form' },
    }),
  );
});

// ---------------------------------------------------------------------------
// Notificationclick: focus existing Tracker window or open a new one
// ---------------------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // If a Tracker window already exists, focus it and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({ type: 'NAVIGATE', route: '/?route=form' });
          return;
        }
      }

      // No existing window — open a new one
      await self.clients.openWindow('/?route=form');
    })(),
  );
});

// ---------------------------------------------------------------------------
// Message handler for SKIP_WAITING (used by the update prompt on the page side)
// ---------------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
