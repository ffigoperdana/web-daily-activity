/**
 * Service Worker registration and update prompt logic (page side).
 *
 * Exposes:
 * - `registerServiceWorker()` — call once from main.tsx on app load.
 * - `onUpdateAvailable(cb)` — subscribe to the "new SW waiting" event.
 * - `applyUpdate()` — tell the waiting SW to skip waiting, then reload.
 */

type UpdateCallback = () => void;

const listeners: Set<UpdateCallback> = new Set();
let waitingRegistration: ServiceWorkerRegistration | null = null;

/**
 * Subscribe to the "update available" event.
 * The callback fires when a new Service Worker is installed and waiting.
 * Returns an unsubscribe function.
 */
export function onUpdateAvailable(cb: UpdateCallback): () => void {
  listeners.add(cb);
  // If an update is already waiting when the subscriber registers, notify immediately.
  if (waitingRegistration?.waiting) {
    cb();
  }
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Tell the waiting Service Worker to activate (SKIP_WAITING) and reload the page.
 */
export function applyUpdate(): void {
  const waiting = waitingRegistration?.waiting;
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }
  // Reload after a short delay to allow the SW to activate.
  // The `controllerchange` listener below also triggers a reload as a fallback.
  window.location.reload();
}

/**
 * Register the Service Worker and listen for updates.
 * Call this once from main.tsx.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  // Reload when a new SW takes control (covers the SKIP_WAITING path).
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  void navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((registration) => {
      // If there's already a waiting worker on page load, surface the prompt.
      if (registration.waiting) {
        waitingRegistration = registration;
        notifyListeners();
        return;
      }

      // Listen for new installing workers.
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;

        installing.addEventListener('statechange', () => {
          // A new SW has installed while a controller already exists →
          // this means an update is available (not the first install).
          if (
            installing.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            waitingRegistration = registration;
            notifyListeners();
          }
        });
      });
    })
    .catch((err: unknown) => {
      console.error('[SW] Registration failed:', err);
    });
}

function notifyListeners(): void {
  for (const cb of listeners) {
    try {
      cb();
    } catch {
      // Swallow errors from individual listeners.
    }
  }
}
