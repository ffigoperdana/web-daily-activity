/**
 * Converts a base64url-encoded VAPID public key to a Uint8Array
 * suitable for use with pushManager.subscribe({ applicationServerKey }).
 */
export declare function urlBase64ToUint8Array(base64String: string): Uint8Array;
/**
 * Requests notification permission and subscribes to Web Push via the
 * service worker's pushManager using the configured VAPID public key.
 *
 * @returns The PushSubscription on success.
 * @throws Error('notification_denied') if the user explicitly denied permission.
 * @throws Error('notification_dismissed') if the user dismissed the prompt (permission stays 'default').
 */
export declare function subscribePush(): Promise<PushSubscription>;
//# sourceMappingURL=subscribe.d.ts.map
