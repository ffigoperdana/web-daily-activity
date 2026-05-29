/**
 * Push_Service API client for the Tracker.
 *
 * All methods target `import.meta.env.VITE_PUSH_SERVICE_URL` and authenticate
 * with `Authorization: Bearer ${idToken}` (Google ID token).
 *
 * Validates: Requirements 5.4, 6.2, 6.6, 10.1
 */

function getPushServiceUrl(): string {
  return import.meta.env.VITE_PUSH_SERVICE_URL ?? '';
}

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
 * Build common request headers with Bearer auth.
 */
function authHeaders(idToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };
}

/**
 * GET /settings — retrieve the current reminder settings.
 *
 * Returns `{ configured: true, time, timezone }` if settings exist,
 * or `{ configured: false }` if no reminder is configured.
 */
export async function getSettings(idToken: string): Promise<SettingsResponse> {
  const response = await fetch(`${getPushServiceUrl()}/settings`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`getSettings failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<SettingsResponse>;
}

/**
 * POST /settings — save reminder time and timezone.
 */
export async function postSettings(
  idToken: string,
  body: { time: string; timezone: string },
): Promise<OkResponse> {
  const response = await fetch(`${getPushServiceUrl()}/settings`, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`postSettings failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<OkResponse>;
}

/**
 * POST /subscribe — register a Web Push subscription.
 */
export async function postSubscribe(
  idToken: string,
  subscription: PushSubscriptionJSON,
): Promise<OkResponse> {
  const response = await fetch(`${getPushServiceUrl()}/subscribe`, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify(subscription),
  });

  if (!response.ok) {
    throw new Error(`postSubscribe failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<OkResponse>;
}

/**
 * DELETE /subscribe — remove a Web Push subscription by endpoint.
 */
export async function deleteSubscribe(idToken: string, endpoint: string): Promise<OkResponse> {
  const response = await fetch(`${getPushServiceUrl()}/subscribe`, {
    method: 'DELETE',
    headers: authHeaders(idToken),
    body: JSON.stringify({ endpoint }),
  });

  if (!response.ok) {
    throw new Error(`deleteSubscribe failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<OkResponse>;
}

/**
 * POST /dispatch/test — trigger a test push notification to all stored subscriptions.
 */
export async function postDispatchTest(idToken: string): Promise<OkResponse> {
  const response = await fetch(`${getPushServiceUrl()}/dispatch/test`, {
    method: 'POST',
    headers: authHeaders(idToken),
  });

  if (!response.ok) {
    throw new Error(`postDispatchTest failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<OkResponse>;
}
