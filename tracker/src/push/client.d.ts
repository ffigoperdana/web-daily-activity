/**
 * Push_Service API client for the Tracker.
 *
 * All methods target `import.meta.env.VITE_PUSH_SERVICE_URL` and authenticate
 * with `Authorization: Bearer ${idToken}` (Google ID token).
 *
 * Validates: Requirements 5.4, 6.2, 6.6, 10.1
 */
/** Response shape for GET /settings when a reminder is configured. */
export interface SettingsConfigured {
  configured: true;
  time: string;
  timezone: string;
}
/** Response shape for GET /settings when no reminder is configured. */
export interface SettingsNotConfigured {
  configured: false;
}
export type SettingsResponse = SettingsConfigured | SettingsNotConfigured;
/** Common success response from mutating endpoints. */
export interface OkResponse {
  ok: boolean;
}
/**
 * GET /settings — retrieve the current reminder settings.
 *
 * Returns `{ configured: true, time, timezone }` if settings exist,
 * or `{ configured: false }` if no reminder is configured.
 */
export declare function getSettings(idToken: string): Promise<SettingsResponse>;
/**
 * POST /settings — save reminder time and timezone.
 */
export declare function postSettings(
  idToken: string,
  body: {
    time: string;
    timezone: string;
  },
): Promise<OkResponse>;
/**
 * POST /subscribe — register a Web Push subscription.
 */
export declare function postSubscribe(
  idToken: string,
  subscription: PushSubscriptionJSON,
): Promise<OkResponse>;
/**
 * DELETE /subscribe — remove a Web Push subscription by endpoint.
 */
export declare function deleteSubscribe(idToken: string, endpoint: string): Promise<OkResponse>;
/**
 * POST /dispatch/test — trigger a test push notification to all stored subscriptions.
 */
export declare function postDispatchTest(idToken: string): Promise<OkResponse>;
//# sourceMappingURL=client.d.ts.map
