import { test, expect } from '@playwright/test';

/**
 * E2E happy-path test for the Daily Activity Tracker.
 *
 * All external APIs are mocked via Playwright route interception:
 * - Google Identity Services (GIS) script → injected mock via addInitScript
 * - Google Calendar API → page.route()
 * - Push_Service → page.route()
 *
 * Validates: Requirements 1.1, 2.1, 3.1, 3.5, 4.4, 5.1, 5.2, 5.3, 5.4, 6.6, 6.8, 6.9
 */

const OWNER_EMAIL = 'owner@example.com';

// A minimal fake ID token (header.payload.signature) with the owner email.
// The payload is base64url-encoded JSON: { "email": "owner@example.com", "email_verified": true }
function makeFakeIdToken(email: string): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const payload = btoa(JSON.stringify({ email, email_verified: true, exp: 9999999999 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const signature = 'fake-signature';
  return `${header}.${payload}.${signature}`;
}

const FAKE_ID_TOKEN = makeFakeIdToken(OWNER_EMAIL);

/**
 * Injects a mock of the Google Identity Services library into the page.
 * This replaces the real GIS script load with a synchronous mock that
 * simulates a successful sign-in flow for the owner account.
 */
function getGisMockScript(): string {
  const idToken = FAKE_ID_TOKEN;
  return `
    // Mock GIS: prevent real script from loading and provide mock API
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: function(config) {
            window.__gisTokenCallback = config.callback;
            return {
              requestAccessToken: function(overrides) {
                // Simulate successful token response
                setTimeout(function() {
                  window.__gisTokenCallback({
                    access_token: 'fake-access-token-12345',
                    expires_in: 3600,
                    scope: 'https://www.googleapis.com/auth/calendar.events',
                    token_type: 'Bearer'
                  });
                }, 10);
              }
            };
          }
        },
        id: {
          initialize: function(config) {
            window.__gisIdCallback = config.callback;
          },
          prompt: function() {
            // Simulate ID token credential response
            setTimeout(function() {
              if (window.__gisIdCallback) {
                window.__gisIdCallback({
                  credential: '${idToken}',
                  select_by: 'auto'
                });
              }
            }, 10);
          }
        }
      }
    };
  `;
}

test.describe('Happy Path', () => {
  test.beforeEach(async ({ page }) => {
    // Inject GIS mock before any page scripts run
    await page.addInitScript({ content: getGisMockScript() });

    // Block the real GIS script from loading
    await page.route('**/accounts.google.com/gsi/client', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '// GIS script blocked - using mock',
      });
    });

    // Mock Google Calendar API - events.insert
    await page.route('**/googleapis.com/calendar/v3/calendars/primary/events', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'fake-event-id-123',
          status: 'confirmed',
          htmlLink: 'https://calendar.google.com/event?eid=fake',
        }),
      });
    });

    // Mock Push_Service: GET /settings
    await page.route('**/settings', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ configured: false }),
        });
      } else if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
      } else {
        route.continue();
      }
    });

    // Mock Push_Service: POST /subscribe
    await page.route('**/subscribe', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    // Mock Push_Service: POST /dispatch/test
    await page.route('**/dispatch/test', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sent: 1, failed: 0, removed: 0 }),
      });
    });
  });

  test('open app → sign in → submit timed activity → see confirmation → navigate to reminders → set time', async ({
    page,
  }) => {
    // 1. Open the app — should show sign-in screen (Req 1.1)
    await page.goto('/');
    await expect(page.getByTestId('sign-in-screen')).toBeVisible();
    await expect(page.getByText('Masuk dengan Google')).toBeVisible();

    // 2. Sign in (Req 1.1, 1.2)
    await page.getByText('Masuk dengan Google').click();

    // Wait for the auth flow to complete — the activity form should appear
    await expect(page.getByTestId('activity-form')).toBeVisible({ timeout: 5000 });

    // 3. Submit a timed activity (Req 2.1, 3.1, 3.5)
    // Uncheck "all-day" to show time inputs
    await page.locator('#activity-allday').uncheck();

    // Fill in the description
    await page.locator('#activity-description').fill('Mengerjakan laporan harian');

    // Set start and end times
    await page.locator('#activity-start-time').fill('09:00');
    await page.locator('#activity-end-time').fill('17:00');

    // Submit the form
    await page.getByTestId('submit-button').click();

    // 4. See confirmation (Req 3.5)
    await expect(page.getByTestId('confirmation')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('confirmation')).toContainText('Aktivitas berhasil disimpan');

    // 5. Navigate to reminders (Req 5.1)
    await page.goto('/?route=reminders');
    await expect(page.getByTestId('reminders-screen')).toBeVisible({ timeout: 5000 });

    // 6. Set reminder time (Req 6.1, 6.2)
    await page.getByTestId('reminder-time-input').fill('07:30');

    // Save settings
    await page.getByTestId('btn-save-settings').click();

    // Verify success feedback
    await expect(page.getByTestId('reminders-success')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Offline Smoke Test', () => {
  test('shows offline banner when network is unavailable (Req 4.4)', async ({ page, context }) => {
    // Inject GIS mock
    await page.addInitScript({ content: getGisMockScript() });

    // Block the real GIS script
    await page.route('**/accounts.google.com/gsi/client', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '// GIS script blocked',
      });
    });

    // Mock Calendar API
    await page.route('**/googleapis.com/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'fake' }),
      });
    });

    // Mock Push_Service routes
    await page.route('**/settings', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: false }),
      });
    });
    await page.route('**/subscribe', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.route('**/dispatch/test', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sent: 1, failed: 0, removed: 0 }),
      });
    });

    // 1. Load the app online first (so assets are cached)
    await page.goto('/');
    await expect(page.getByTestId('sign-in-screen')).toBeVisible();

    // 2. Go offline
    await context.setOffline(true);

    // Trigger the browser's offline event so the app detects it
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // 3. Assert the offline banner appears with the expected text
    await expect(page.getByTestId('offline-banner')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('offline-banner')).toContainText('tidak ada koneksi');
  });
});
