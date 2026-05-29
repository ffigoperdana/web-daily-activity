declare interface ServiceWorkerGlobalScope {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
}

// Extend NotificationOptions with properties supported by browsers but missing from TS lib types.
declare interface NotificationOptions {
  renotify?: boolean;
}
