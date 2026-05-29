# Requirements Document

## Introduction

The Daily Activity Tracker (DAT) is a personal, single-user Progressive Web App that lets the owner quickly log a daily work activity from a mobile device. Each submission is written directly to the owner's personal Google Calendar as a calendar event, so Google Calendar acts as the source of truth for activity history. The application is hosted online and protected by Google sign-in. The same Google sign-in produces the OAuth access token used to call the Google Calendar API, so a single authentication step covers both identity and Calendar write authorization. To help the owner build a daily logging habit, the application supports installable PWA behavior and Web Push notifications delivered through the standard Web Push API and VAPID keys (Firebase and Firebase Cloud Messaging are explicitly excluded).

User-facing copy is rendered in Bahasa Indonesia. This requirements document itself is written in English to comply with the EARS pattern conventions defined in the spec workflow.

## Glossary

- **Tracker**: The Daily Activity Tracker client application (PWA front-end) that runs in the user's browser.
- **Auth_Module**: The component inside the Tracker that handles Google Identity Services (GIS) sign-in, account allow-listing, and OAuth token acquisition for the Google Calendar API.
- **Activity_Form**: The single-screen form inside the Tracker used to enter and submit a daily activity.
- **Calendar_Sync**: The component inside the Tracker that calls the Google Calendar API `events.insert` endpoint to create events from submitted activities.
- **PWA_Shell**: The Progressive Web App layer of the Tracker, including the Web App Manifest and the Service Worker.
- **Service_Worker**: The browser-managed background script registered by the PWA_Shell that handles caching, push events, and notification clicks.
- **Push_Service**: A small server-side component that stores Web Push subscriptions, stores reminder settings, and sends Web Push messages signed with VAPID keys.
- **Reminder_Scheduler**: A scheduled job (for example a Vercel Cron job or a GitHub Actions cron workflow) that triggers the Push_Service to send the daily reminder.
- **Owner_Account**: The single Google account email address allow-listed for use of the Tracker, configured via environment variable.
- **VAPID_Keys**: The Voluntary Application Server Identification public/private key pair used to authenticate Web Push messages without Firebase Cloud Messaging.
- **All_Day_Event**: A Google Calendar event created with `start.date` and `end.date` fields and no time component.
- **Timed_Event**: A Google Calendar event created with `start.dateTime` and `end.dateTime` fields that include an IANA time zone identifier.

## Requirements

### Requirement 1: Google Sign-In with Calendar Authorization

**User Story:** As the owner, I want to sign in once with my Google account, so that the Tracker can both verify my identity and write events to my personal Google Calendar without a second authorization step.

#### Acceptance Criteria

1. WHILE no valid Google session exists in the Tracker, THE Tracker SHALL display a Google sign-in entry screen and SHALL prevent rendering of the Activity_Form.
2. WHEN the owner activates the Google sign-in control, THE Auth_Module SHALL initiate a Google Identity Services OAuth 2.0 token flow that requests the `https://www.googleapis.com/auth/calendar.events` scope.
3. WHEN the Google Identity Services flow returns an access token, THE Auth_Module SHALL retain the access token in browser memory only and SHALL NOT write the access token to `localStorage` or `sessionStorage`.
4. IF the signed-in account email does not match the configured Owner_Account, THEN THE Auth_Module SHALL clear any retained access token and SHALL display an "akun tidak diizinkan" message.
5. WHEN the retained access token has expired, THE Auth_Module SHALL request a new access token through the Google Identity Services token client before the next Google Calendar API call.
6. IF the Google Identity Services token request fails, THEN THE Auth_Module SHALL display the underlying error message and SHALL return the Tracker to the sign-in entry screen.
7. IF initialization of the Google Identity Services token client fails before any token request reaches Google, THEN THE Auth_Module SHALL display an "gagal memulai login Google" error message and SHALL display a "coba lagi" retry control that re-initializes the token client when activated.

### Requirement 2: Activity Submission Form

**User Story:** As the owner, I want a minimal form to enter today's activity, so that I can log my work day in a few seconds on my phone.

#### Acceptance Criteria

1. THE Activity_Form SHALL display a date input field, an activity description text field, and an "all-day" toggle control.
2. THE Activity_Form SHALL pre-fill the date input field with the current local date on first render.
3. WHERE the all-day toggle is set to off, THE Activity_Form SHALL display a start time input and an end time input.
4. WHERE the all-day toggle is set to on, THE Activity_Form SHALL hide the start time input and the end time input.
5. IF the activity description field contains zero non-whitespace characters when the submit control is activated, THEN THE Activity_Form SHALL display a validation error labeled "deskripsi aktivitas wajib diisi" and SHALL block submission.
6. IF the all-day toggle is off and the end time is earlier than or equal to the start time on the same date, THEN THE Activity_Form SHALL display a validation error labeled "waktu selesai harus setelah waktu mulai" and SHALL block submission.
7. IF the activity description field contains more than 1024 characters, THEN THE Activity_Form SHALL display a validation error labeled "deskripsi terlalu panjang (maksimal 1024 karakter)" and SHALL block submission.
8. WHILE a Google Calendar API request is in progress for the current submission, THE Activity_Form SHALL disable the submit control to prevent duplicate submissions.

### Requirement 3: Google Calendar Event Creation

**User Story:** As the owner, I want each submitted activity to appear in my personal Google Calendar, so that my Calendar acts as the single source of truth for my daily activity log.

#### Acceptance Criteria

1. WHEN the Activity_Form passes validation and the submit control is activated, THE Calendar_Sync SHALL call the Google Calendar API `events.insert` endpoint against the calendar identifier `primary`.
2. WHERE the all-day toggle is set to on, THE Calendar_Sync SHALL build an All_Day_Event payload using the selected date as `start.date` and the selected date plus one day as `end.date`.
3. WHERE the all-day toggle is set to off, THE Calendar_Sync SHALL build a Timed_Event payload using the selected date and start time as `start.dateTime`, the selected date and end time as `end.dateTime`, and the browser-resolved IANA time zone identifier as `start.timeZone` and `end.timeZone`.
4. THE Calendar_Sync SHALL set the `summary` field of the event payload to the trimmed activity description from the Activity_Form.
5. IF the Google Calendar API responds with HTTP status 200, THEN THE Tracker SHALL display a confirmation message that contains the event date and SHALL clear the activity description field while keeping the date input on the submitted date.
6. IF the Google Calendar API responds with HTTP status 401 on the first attempt, THEN THE Calendar_Sync SHALL request a fresh access token from the Auth_Module and SHALL retry the same `events.insert` call exactly one time, AND IF that single retry also returns a non-2xx status, THEN THE Tracker SHALL display the API error message and SHALL retain the values in the Activity_Form.
7. IF the Google Calendar API responds with any non-2xx status other than 401 on the first attempt, THEN THE Tracker SHALL display the API error message and SHALL retain the values in the Activity_Form.

### Requirement 4: Progressive Web App Installability

**User Story:** As the owner, I want to install the Tracker as an app on my phone, so that I can launch it from the home screen like any native app.

#### Acceptance Criteria

1. THE PWA_Shell SHALL serve a Web App Manifest at a stable URL that defines the fields `name`, `short_name`, `start_url`, `scope`, `display` set to `standalone`, `theme_color`, `background_color`, and an `icons` array containing at minimum a 192x192 PNG icon and a 512x512 PNG icon.
2. THE PWA_Shell SHALL register a Service_Worker on application startup using a relative scope that covers the entire Tracker.
3. THE Service_Worker SHALL pre-cache the application shell assets required to render the sign-in screen and the Activity_Form on the next load.
4. WHEN a previously cached static asset is requested and the network is unavailable, THE Service_Worker SHALL serve the asset from cache.
5. IF a static asset is requested while offline and no cached copy of that asset exists, THEN THE Service_Worker SHALL respond with an offline fallback response that includes an "aset tidak tersedia saat offline" message.
6. WHEN a new Service_Worker version finishes installing, THE PWA_Shell SHALL display a non-blocking in-app prompt that lets the owner reload the Tracker to activate the new version, AND THE PWA_Shell SHALL leave any existing browser-level or in-app reload control fully usable while the prompt is displayed.

### Requirement 5: Web Push Subscription Setup

**User Story:** As the owner, I want to enable push notifications inside the Tracker, so that the server can deliver a daily reminder to my phone.

#### Acceptance Criteria

1. THE Tracker SHALL provide an "aktifkan pengingat" control that is visible only to a signed-in Owner_Account session.
2. WHEN the owner activates the "aktifkan pengingat" control, THE Tracker SHALL call the browser Notification permission API.
3. WHEN browser notification permission is in the `granted` state, THE Tracker SHALL call the Push API `pushManager.subscribe` method using the configured VAPID public key and `userVisibleOnly` set to `true`.
4. WHEN `pushManager.subscribe` returns a subscription object, THE Tracker SHALL POST the subscription object to the Push_Service `subscribe` endpoint along with the current Google ID token.
5. THE Push_Service SHALL verify that the Google ID token is valid and that the token's email claim matches the Owner_Account before storing any subscription.
6. WHEN the Push_Service receives a valid subscribe request, THE Push_Service SHALL persist the subscription such that at most one active subscription per browser endpoint URL is stored.
7. IF the browser notification permission is in the `denied` state, THEN THE Tracker SHALL display a message labeled "izinkan notifikasi di pengaturan browser" and SHALL keep the "aktifkan pengingat" control visible.
8. WHILE the browser notification permission is in the `granted` state, THE Tracker SHALL NOT display the "izinkan notifikasi di pengaturan browser" message.

### Requirement 6: Daily Reminder Delivery

**User Story:** As the owner, I want to receive a push notification once per day at a time I choose, so that I remember to log my activity.

#### Acceptance Criteria

1. THE Tracker SHALL provide a reminder time input that accepts an `HH:MM` value in 24-hour format and an IANA time zone identifier resolved from the browser.
2. WHEN the owner saves a reminder time, THE Tracker SHALL POST the time and the time zone to the Push_Service `settings` endpoint with the current Google ID token.
3. THE Push_Service SHALL persist the most recent reminder time and time zone for the Owner_Account.
4. WHEN the Reminder_Scheduler fires, THE Reminder_Scheduler SHALL invoke the Push_Service `dispatch` endpoint.
5. WHEN the Push_Service `dispatch` endpoint is invoked, THE Push_Service SHALL evaluate the current time in the stored time zone and SHALL send a Web Push message to every stored subscription if the current time falls within the same `HH:MM` minute as the stored reminder time.
6. THE Push_Service SHALL expose a separate `dispatch/test` endpoint that, when invoked with a valid bearer token belonging to the Owner_Account, SHALL send a Web Push message to every stored subscription without evaluating the stored reminder time.
7. THE Push_Service SHALL sign every Web Push request using the VAPID_Keys private key and the configured VAPID subject.
8. WHEN the Service_Worker receives a push event, THE Service_Worker SHALL display a system notification with the title "Catat Aktivitas Hari Ini" and a body that contains the current local date and the call-to-action text "Belum dicatat — ketuk untuk membuka".
9. WHEN the owner activates the displayed notification, THE Service_Worker SHALL open or focus the Tracker at the Activity_Form route.
10. IF the Web Push send returns HTTP status 404 or 410 for a subscription, THEN THE Push_Service SHALL delete that subscription from storage.

### Requirement 7: Single-User Access Control on the Push_Service

**User Story:** As the owner, I want only my Google account to be able to register push subscriptions or change reminder settings, so that the public Push_Service URL cannot be abused.

#### Acceptance Criteria

1. THE Push_Service SHALL read the Owner_Account email and the Google OAuth client ID from environment variables on startup.
2. WHEN the Push_Service receives a request to any endpoint other than `dispatch`, THE Push_Service SHALL require an `Authorization: Bearer <id_token>` header.
3. WHEN an `Authorization` header is present, THE Push_Service SHALL verify the bearer token as a Google ID token signed by Google and issued for the configured Google OAuth client ID.
4. IF the bearer token is missing, expired, has an invalid signature, or carries an `email` claim that does not equal the Owner_Account, THEN THE Push_Service SHALL respond with HTTP status 403 and SHALL NOT mutate any stored data.
5. THE Push_Service `dispatch` endpoint SHALL require a shared secret header whose value matches a `DISPATCH_SECRET` environment variable.
6. IF a request to the `dispatch` endpoint omits the shared secret header or sends a value that does not match `DISPATCH_SECRET`, THEN THE Push_Service SHALL respond with HTTP status 403 and SHALL NOT send any push messages.

### Requirement 8: Online Hosting and Transport Security

**User Story:** As the owner, I want the Tracker and the Push_Service to be reachable from any device on the internet over HTTPS, so that I can use them from my phone and so that browser PWA and Web Push features work.

#### Acceptance Criteria

1. THE Tracker SHALL be served over HTTPS from a publicly reachable origin.
2. THE Push_Service SHALL be served over HTTPS from a publicly reachable origin.
3. THE Tracker SHALL load all scripts, styles, icons, and API requests over HTTPS.
4. THE Push_Service SHALL set a `Cache-Control: no-store` response header on every JSON response.

### Requirement 9: Configuration via Environment Variables

**User Story:** As the owner, I want every secret and account-specific value to come from environment variables, so that I can deploy the Tracker and the Push_Service without editing source code.

#### Acceptance Criteria

1. THE Tracker SHALL read the Google OAuth client ID and the VAPID public key from build-time environment variables prefixed for the chosen front-end build tool.
2. THE Push_Service SHALL read the VAPID public key, the VAPID private key, the VAPID subject, the Google OAuth client ID, the Owner_Account email, and the `DISPATCH_SECRET` from runtime environment variables.
3. IF any required environment variable for the Push_Service is missing on startup, THEN THE Push_Service SHALL refuse to start and SHALL log the name of every missing variable.
4. THE Tracker source repository SHALL include a `.env.example` file that lists every required environment variable name with an empty value.

### Requirement 10: Reminder Settings Read-Back

**User Story:** As the owner, I want the Tracker to show me my current reminder time when I open the settings screen, so that I do not have to remember what I configured.

#### Acceptance Criteria

1. WHEN the owner opens the reminder settings screen, THE Tracker SHALL GET the current reminder time and time zone from the Push_Service `settings` endpoint with the current Google ID token.
2. WHEN the Push_Service `settings` endpoint receives a valid GET request and a stored reminder time exists, THE Push_Service SHALL respond with HTTP status 200 and a JSON body containing the stored time and time zone.
3. WHEN the Push_Service `settings` endpoint receives a valid GET request and no stored reminder time exists, THE Push_Service SHALL respond with HTTP status 200 and a JSON body indicating that no reminder is configured.
4. WHEN the Tracker receives a "no reminder configured" response, THE Tracker SHALL pre-fill the reminder time input with `08:00` and SHALL pre-fill the time zone with the browser-resolved IANA time zone identifier.
