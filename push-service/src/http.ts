/**
 * HTTP response helpers for the Push_Service.
 * All JSON responses include `Cache-Control: no-store` (Requirement 8.4).
 */

/**
 * Creates a JSON Response with standard headers.
 */
export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Returns a 403 Forbidden response.
 */
export function forbidden(): Response {
  return json(403, { error: 'forbidden' });
}

/**
 * Returns a 400 Bad Request response with an optional message.
 */
export function badRequest(message?: string): Response {
  const body: { error: string; message?: string } = { error: 'bad_request' };
  if (message !== undefined) {
    body.message = message;
  }
  return json(400, body);
}

/**
 * Returns a 500 Misconfigured response listing missing env vars.
 */
export function misconfigured(missing: string[]): Response {
  return json(500, { error: 'misconfigured', missing });
}
