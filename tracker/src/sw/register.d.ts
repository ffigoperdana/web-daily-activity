/**
 * Service Worker registration and update prompt logic (page side).
 *
 * Exposes:
 * - `registerServiceWorker()` — call once from main.tsx on app load.
 * - `onUpdateAvailable(cb)` — subscribe to the "new SW waiting" event.
 * - `applyUpdate()` — tell the waiting SW to skip waiting, then reload.
 */
type UpdateCallback = () => void;
/**
 * Subscribe to the "update available" event.
 * The callback fires when a new Service Worker is installed and waiting.
 * Returns an unsubscribe function.
 */
export declare function onUpdateAvailable(cb: UpdateCallback): () => void;
/**
 * Tell the waiting Service Worker to activate (SKIP_WAITING) and reload the page.
 */
export declare function applyUpdate(): void;
/**
 * Register the Service Worker and listen for updates.
 * Call this once from main.tsx.
 */
export declare function registerServiceWorker(): void;
export {};
//# sourceMappingURL=register.d.ts.map
