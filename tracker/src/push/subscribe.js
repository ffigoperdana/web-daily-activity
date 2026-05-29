const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
/**
 * Converts a base64url-encoded VAPID public key to a Uint8Array
 * suitable for use with pushManager.subscribe({ applicationServerKey }).
 */
export function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
/**
 * Requests notification permission and subscribes to Web Push via the
 * service worker's pushManager using the configured VAPID public key.
 *
 * @returns The PushSubscription on success.
 * @throws Error('notification_denied') if the user explicitly denied permission.
 * @throws Error('notification_dismissed') if the user dismissed the prompt (permission stays 'default').
 */
export async function subscribePush() {
    const permission = await Notification.requestPermission();
    if (permission === 'denied') {
        throw new Error('notification_denied');
    }
    if (permission === 'default') {
        throw new Error('notification_dismissed');
    }
    // permission === 'granted'
    const registration = await navigator.serviceWorker.ready;
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer,
    });
    return subscription;
}
//# sourceMappingURL=subscribe.js.map