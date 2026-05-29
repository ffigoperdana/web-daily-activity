/**
 * Push_Service API client for the Tracker.
 *
 * All methods target `import.meta.env.VITE_PUSH_SERVICE_URL` and authenticate
 * with `Authorization: Bearer ${idToken}` (Google ID token).
 *
 * Validates: Requirements 5.4, 6.2, 6.6, 10.1
 */
function getPushServiceUrl() {
  return import.meta.env.VITE_PUSH_SERVICE_URL ?? '';
}
/**
 * Build common request headers with Bearer auth.
 */
function authHeaders(idToken) {
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
export async function getSettings(idToken) {
  const response = await fetch(`${getPushServiceUrl()}/settings`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(`getSettings failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
/**
 * POST /settings — save reminder time and timezone.
 */
export async function postSettings(idToken, body) {
  const response = await fetch(`${getPushServiceUrl()}/settings`, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`postSettings failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
/**
 * POST /subscribe — register a Web Push subscription.
 */
export async function postSubscribe(idToken, subscription) {
  const response = await fetch(`${getPushServiceUrl()}/subscribe`, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify(subscription),
  });
  if (!response.ok) {
    throw new Error(`postSubscribe failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
/**
 * DELETE /subscribe — remove a Web Push subscription by endpoint.
 */
export async function deleteSubscribe(idToken, endpoint) {
  const response = await fetch(`${getPushServiceUrl()}/subscribe`, {
    method: 'DELETE',
    headers: authHeaders(idToken),
    body: JSON.stringify({ endpoint }),
  });
  if (!response.ok) {
    throw new Error(`deleteSubscribe failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
/**
 * POST /dispatch/test — trigger a test push notification to all stored subscriptions.
 */
export async function postDispatchTest(idToken) {
  const response = await fetch(`${getPushServiceUrl()}/dispatch/test`, {
    method: 'POST',
    headers: authHeaders(idToken),
  });
  if (!response.ok) {
    throw new Error(`postDispatchTest failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
//# sourceMappingURL=client.js.map
