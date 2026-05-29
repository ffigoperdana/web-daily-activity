# Implementation Plan: Daily Activity Tracker

## Overview

This plan implements the Daily Activity Tracker per `requirements.md` and `design.md` in two independently deployable units sharing one monorepo:

- **Tracker** — Vite + React 18 + TypeScript PWA in `tracker/`
- **Push_Service** — Cloudflare Workers + KV + TypeScript service in `push-service/`

The implementation language is **TypeScript** for both units (declared in the design — no language ambiguity). Tasks build incrementally: scaffolding → pure logic → property tests next to that logic → effectful glue → wiring → integration tests → deployment configs. Property-based tests use `fast-check` with `numRuns: 100` and live in the file map declared in design §Testing Strategy. Each property task references the property number from design §Correctness Properties and the requirement clauses it validates.

The design has a **Correctness Properties** section with 13 properties, so property-based test sub-tasks ARE included. Test sub-tasks are marked optional with `*`; core implementation tasks are not.

Convert the feature design into a series of prompts for a code-generation LLM that will implement each step with incremental progress. Make sure that each prompt builds on the previous prompts, and ends with wiring things together. There should be no hanging or orphaned code that isn't integrated into a previous step. Focus ONLY on tasks that involve writing, modifying, or testing code.

## Tasks

- [x] 1. Bootstrap monorepo layout and shared tooling
  - [x] 1.1 Create root workspace files
    - Create root `package.json` with pnpm workspaces (`tracker/*`, `push-service/*`), root `pnpm-workspace.yaml`, root `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
    - Add root `.gitignore` (node_modules, dist, .wrangler, .env, .env.local, coverage, playwright-report)
    - Add root `.editorconfig` and `prettier.config.cjs`
    - Add root `.env.example` with every variable from design §Environment Variables (`VITE_GOOGLE_CLIENT_ID`, `VITE_OWNER_EMAIL`, `VITE_VAPID_PUBLIC_KEY`, `VITE_PUSH_SERVICE_URL`, `GOOGLE_CLIENT_ID`, `OWNER_EMAIL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `DISPATCH_SECRET`), each with empty value, exactly once
    - _Requirements: 9.1, 9.2, 9.4_

  - [x] 1.2 Add VAPID key generation script
    - Create `scripts/generate-vapid.mjs` that wraps `npx web-push generate-vapid-keys --json` and prints instructions to copy `publicKey` to `VITE_VAPID_PUBLIC_KEY` and `VAPID_PUBLIC_KEY`, and to set `VAPID_PRIVATE_KEY` via `wrangler secret put VAPID_PRIVATE_KEY`
    - Add `pnpm vapid:generate` script to root `package.json`
    - _Requirements: 9.1, 9.2_

  - [x]* 1.3 Write smoke test for `.env.example` content
    - Test reads `.env.example` and asserts every required variable name from design §Environment Variables appears exactly once with an empty value
    - _Requirements: 9.4_

- [x] 2. Scaffold the Tracker (Vite + React + TypeScript + PWA)
  - [x] 2.1 Initialize Vite React-TS project in `tracker/`
    - Run `pnpm create vite tracker --template react-ts` equivalent (commit generated files), prune the demo content
    - Add deps: `react`, `react-dom`, `fast-check`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `vite-plugin-pwa` (used in `injectManifest` mode only), `@vitest/coverage-v8`
    - Configure `tracker/vite.config.ts` with `vite-plugin-pwa` in `injectManifest` mode pointing at `src/sw/service-worker.ts`, output `dist/sw.js`, scope `/`
    - Configure `tracker/tsconfig.json` extending root base, `tracker/vitest.config.ts` with `environment: 'jsdom'`, `setupFiles: ['./src/test-setup.ts']`
    - Create `src/test-setup.ts` importing `@testing-library/jest-dom`
    - _Requirements: 4.1, 4.2_

  - [x] 2.2 Create Bahasa Indonesia i18n module
    - Create `tracker/src/i18n/id.ts` exporting a flat string-keyed object with every Bahasa Indonesia user-facing string from requirements/design: `akun_tidak_diizinkan`, `gagal_memulai_login_google`, `coba_lagi`, `sesi_berakhir`, `deskripsi_wajib`, `deskripsi_terlalu_panjang`, `waktu_selesai`, `tidak_bisa_menghubungi_calendar`, `gagal_simpan_calendar`, `aset_tidak_tersedia_offline`, `tidak_ada_koneksi`, `aktifkan_pengingat`, `izinkan_notifikasi`, `kirim_notifikasi_tes`, `simpan_jam_pengingat`, `versi_baru_tersedia`, `muat_ulang`, `notifikasi_tidak_tersedia`, `notification_title` (`Catat Aktivitas Hari Ini`), `notification_cta` (`Belum dicatat — ketuk untuk membuka`)
    - _Requirements: 1.4, 1.6, 1.7, 2.5, 2.6, 2.7, 4.5, 4.6, 5.7, 6.8_

  - [x]* 2.3 Write unit tests for i18n module
    - Test that every key required by requirements is present and non-empty
    - Test that `notification_title` equals `Catat Aktivitas Hari Ini` and `notification_cta` equals `Belum dicatat — ketuk untuk membuka`
    - _Requirements: 6.8_

- [x] 3. Implement Tracker pure-logic core (validation, payload, date math)
  - [x] 3.1 Implement `validateActivity` and types
    - Create `tracker/src/calendar/types.ts` with `ActivityInput`, `ValidationResult`, `ValidationError`, `CalendarEvent` types from design §Data Models
    - Create `tracker/src/calendar/validation.ts` exporting pure `validateActivity(input): ValidationResult` enforcing trimmed-length 1..1024 and `endTime > startTime` for non-all-day, with error codes `description: 'required' | 'too_long'` and `time: 'end_before_or_equal_start'`
    - _Requirements: 2.5, 2.6, 2.7_

  - [x] 3.2 Implement `addOneDay` pure helper
    - Create `tracker/src/calendar/date-math.ts` exporting `addOneDay(date: string): string` operating on `YYYY-MM-DD` in the proleptic Gregorian calendar (handles month-end, year-end, leap years)
    - _Requirements: 3.2_

  - [x] 3.3 Implement `buildEventPayload` pure function
    - Create `tracker/src/calendar/build-payload.ts` exporting `buildEventPayload(input: ActivityInput, tz: string): CalendarEvent`
    - All-day branch: `summary = trimmed description`, `start.date = input.date`, `end.date = addOneDay(input.date)`, no `dateTime`
    - Timed branch: `summary = trimmed description`, `start.dateTime = input.date + 'T' + input.startTime + ':00'`, `end.dateTime = input.date + 'T' + input.endTime + ':00'`, `start.timeZone = end.timeZone = tz`, no `date`
    - _Requirements: 3.2, 3.3, 3.4_

  - [x]* 3.4 Write property test for `validateActivity`
    - File: `tracker/tests/properties/validation.property.test.ts`
    - **Property 1: validateActivity contract**
    - Use `fast-check` with `numRuns: 100`; arbitraries for descriptions (mixing whitespace, emoji, long strings) and HH:MM pairs; tag with comment `// Feature: daily-activity-tracker, Property 1`
    - **Validates: Requirements 2.5, 2.6, 2.7**

  - [x]* 3.5 Write property test for `buildEventPayload`
    - File: `tracker/tests/properties/calendar-payload.property.test.ts`
    - **Property 2: buildEventPayload structural correctness**
    - Generators include leap day `YYYY-02-29`, month-end `YYYY-MM-30`/`31`, year-end `YYYY-12-31`; description with surrounding whitespace; both `allDay` branches; curated IANA tz list; `numRuns: 100`
    - **Validates: Requirements 3.2, 3.3, 3.4**

  - [x]* 3.6 Write unit tests for `addOneDay` edge cases
    - Cover `2024-02-28 → 2024-02-29`, `2024-02-29 → 2024-03-01`, `2025-02-28 → 2025-03-01`, `2025-12-31 → 2026-01-01`, `2025-04-30 → 2025-05-01`
    - _Requirements: 3.2_

- [x] 4. Implement Tracker Auth_Module (Google Identity Services)
  - [x] 4.1 Create GIS script loader and types
    - Create `tracker/src/auth/gis-loader.ts` exporting `loadGisScript(): Promise<void>` that injects `<script src="https://accounts.google.com/gsi/client" async defer>` exactly once and resolves on `load`, rejects on `error`
    - Create `tracker/src/auth/gis-types.ts` with minimal TypeScript declarations for `google.accounts.oauth2.initTokenClient` and `google.accounts.id.initialize` based on the GIS reference
    - _Requirements: 1.7, 8.3_

  - [x] 4.2 Implement `AuthContext` and email-gate logic
    - Create `tracker/src/auth/AuthContext.tsx` exposing the `AuthContextValue` interface from design §Auth_Module
    - Implement `decodeIdTokenEmail(idToken)` (base64url-decode payload only, no verification — server is the trust boundary)
    - Implement `isOwner(email, ownerEmail)` performing case-insensitive comparison
    - Status transitions: `loading → signed-out → signed-in | forbidden`; `init-failed` when `loadGisScript` rejects or `initTokenClient` throws
    - Tokens held in React state only (never `localStorage`/`sessionStorage`)
    - Implement `getValidAccessToken()` (returns cached token if not expired; otherwise calls `requestAccessToken({ prompt: '' })` for silent refresh) and `getIdToken()`
    - On forbidden: clear cached access token, set rendered message to `akun tidak diizinkan` from i18n
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 4.3 Implement `SignIn` screen component
    - Create `tracker/src/components/SignIn.tsx` rendering "Masuk dengan Google" button, `init-failed` view with `gagal memulai login Google` and `coba lagi` button calling `retryInit()`, error view for failed token requests, and the forbidden view
    - _Requirements: 1.1, 1.6, 1.7_

  - [x]* 4.4 Write property test for Owner_Account email gate
    - File: `tracker/tests/properties/auth-gate.property.test.ts`
    - **Property 4: Owner_Account email gate (Tracker UI)**
    - Generators: arbitrary email strings including the exact owner email and case variants; `numRuns: 100`
    - Assert `status === 'signed-in'` iff `e.toLowerCase() === OWNER_EMAIL.toLowerCase()`; otherwise cached access token is null and rendered output contains `akun tidak diizinkan`
    - **Validates: Requirements 1.4**

  - [x]* 4.5 Write unit tests for `SignIn` rendering and GIS wiring
    - Mock `google.accounts.oauth2` and `google.accounts.id`; assert sign-in click invokes `requestAccessToken` with scope `https://www.googleapis.com/auth/calendar.events`
    - Assert tokens never appear in `localStorage` or `sessionStorage` after a sign-in
    - Test `coba lagi` retry path
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7_

- [x] 5. Implement Tracker Calendar_Sync effectful layer
  - [x] 5.1 Implement `insertEvent` with retry-on-401
    - Create `tracker/src/calendar/insert-event.ts` exporting `insertEvent(payload, auth): Promise<InsertEventResult>`
    - POST to `https://www.googleapis.com/calendar/v3/calendars/primary/events` with `Authorization: Bearer ${accessToken}`
    - On 401 first response only: call `auth.getValidAccessToken()` exactly once, then retry the request exactly once
    - Return `{ ok: true, eventId }` on 2xx else `{ ok: false, status, message }` extracting `error.error.message` from JSON body when available
    - On `fetch` rejection (network error): return `{ ok: false, status: 0, message: '<i18n tidak_bisa_menghubungi_calendar>' }`
    - _Requirements: 3.1, 3.5, 3.6, 3.7_

  - [x]* 5.2 Write property test for `insertEvent` retry semantics
    - File: `tracker/tests/properties/insert-event.property.test.ts`
    - **Property 3: insertEvent retries exactly once on 401 only**
    - Generators: mock fetch response sequences (status code arbitraries biased toward 200, 401, 403, 500); `numRuns: 100`
    - Assert call counts exactly: 1 for 2xx, 1 for non-401 non-2xx, 2 for 401-then-anything; assert `getValidAccessToken` called exactly once between the two fetches when first is 401; form values unchanged when final outcome non-2xx
    - **Validates: Requirements 3.6, 3.7**

- [x] 6. Implement Tracker `Activity_Form` and submit flow
  - [x] 6.1 Implement `ActivityForm` component
    - Create `tracker/src/components/ActivityForm.tsx` with `FormState` from design §Activity_Form
    - Pre-fill date with current local date; render description textarea, all-day toggle, conditional start/end time inputs
    - Wire `validateActivity` for inline error messages from i18n (`deskripsi_wajib`, `deskripsi_terlalu_panjang`, `waktu_selesai`)
    - Disable submit while a request is in flight (Requirement 2.8)
    - On submit: call `buildEventPayload(input, Intl.DateTimeFormat().resolvedOptions().timeZone)`, then `insertEvent`
    - On 2xx: render confirmation containing the event date, clear description, keep date; on non-2xx: render error toast and retain values
    - State machine matches design §Error Handling §2 (Idle → Validating → Submitting → Refreshing → Retrying → Confirmed/Failed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.8, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x]* 6.2 Write unit tests for `ActivityForm` rendering and wiring
    - Test inline validation messages, all-day toggle hides/shows time inputs, submit disabled during in-flight, date prefill, confirmation message, error retention
    - Mock `insertEvent` to assert it is called with the right payload
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.8, 3.5_

- [x] 7. Checkpoint - Tracker pure logic, auth, and submit
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement Tracker PWA shell (manifest + icons)
  - [x] 8.1 Add Web App Manifest
    - Create `tracker/public/manifest.webmanifest` with the exact JSON from design §Data Models (name, short_name, description, lang `id-ID`, start_url `/?source=pwa`, scope `/`, display `standalone`, orientation `portrait`, background_color and theme_color `#0f172a`, icons array with 192, 512, and maskable-512)
    - Link manifest from `tracker/index.html` and add `<meta name="theme-color" content="#0f172a">`
    - _Requirements: 4.1_

  - [x] 8.2 Generate PWA icons
    - Add a source SVG `tracker/assets/icon-source.svg`
    - Add a script `tracker/scripts/generate-icons.mjs` using `pwa-asset-generator` (or `sharp`) to emit `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`
    - Add `pnpm icons:generate` script
    - Commit the generated PNGs
    - _Requirements: 4.1_

  - [x]* 8.3 Write unit test for manifest schema and icon presence
    - Parse `manifest.webmanifest`, assert all required fields, assert icon files exist at declared paths with correct sizes
    - _Requirements: 4.1_

- [x] 9. Implement Tracker Service_Worker
  - [x] 9.1 Implement install/activate/fetch handlers
    - Create `tracker/src/sw/service-worker.ts` (compiled by Vite `injectManifest` to `dist/sw.js`)
    - Install: precache the asset list injected by Vite (`self.__WB_MANIFEST`) into a build-hash-keyed cache
    - Activate: delete caches whose key !== current build hash
    - Fetch: cache-first for precached assets; navigation requests fall back to cached `index.html`; missing precached asset while offline returns a synthetic `Response` with body `aset tidak tersedia saat offline`, status `503`, header `Content-Type: text/plain; charset=utf-8` and `X-DAT-Offline: 1`
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [x] 9.2 Implement push handler with date and CTA
    - In `service-worker.ts`, register a `push` event listener that parses payload (defensively: empty / malformed JSON / arbitrary JSON all OK)
    - Build `body` as `${new Date().toLocaleDateString('id-ID')} — Belum dicatat — ketuk untuk membuka`
    - Call `self.registration.showNotification('Catat Aktivitas Hari Ini', { body, tag: 'daily-reminder', renotify: true, data: { route: '/?route=form' } })`
    - Handler MUST NOT throw on malformed/missing payloads (`event.waitUntil(Promise.resolve(...))` semantics)
    - _Requirements: 6.8_

  - [x] 9.3 Implement notificationclick handler
    - On `notificationclick`: close the notification, `clients.matchAll({ type: 'window', includeUncontrolled: true })`, focus existing Tracker window and `postMessage({ type: 'NAVIGATE', route: '/?route=form' })`, otherwise `clients.openWindow('/?route=form')`
    - _Requirements: 6.9_

  - [x] 9.4 Implement SW update prompt (page side)
    - Create `tracker/src/sw/register.ts` exposing `registerServiceWorker()` called from `main.tsx`
    - Listen for `updatefound` and `installed` while a controller exists; surface a non-blocking React toast with copy `versi baru tersedia` and a `muat ulang` button that does `registration.waiting.postMessage({ type: 'SKIP_WAITING' })` then reloads
    - In `service-worker.ts`, `self.addEventListener('message', ...)` for `SKIP_WAITING` calls `self.skipWaiting()`
    - Toast must be dismissible and must not block any browser-level reload UI
    - _Requirements: 4.6_

  - [x]* 9.5 Write property test for SW push handler
    - File: `tracker/tests/properties/sw-push-handler.property.test.ts`
    - **Property 9: Push handler renders the correct title, date, and call-to-action**
    - Generators: arbitrary push payloads (empty, malformed, large, arbitrary JSON), arbitrary mocked dates; `numRuns: 100`
    - Assert `showNotification` called with `title === 'Catat Aktivitas Hari Ini'` and body containing both `toLocaleDateString('id-ID')` of mocked date AND `Belum dicatat — ketuk untuk membuka`; assert handler does not throw
    - **Validates: Requirements 6.8**

  - [x]* 9.6 Write unit tests for SW fetch / offline / update prompt
    - Use `service-worker-mock` or a hand-rolled SW test harness
    - Test cache-first hit, navigation fallback to `index.html`, synthetic 503 with `aset tidak tersedia saat offline`, notificationclick focuses existing client or opens new window, update toast surfaces and reloads on `muat ulang`
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 6.9_

- [x] 10. Implement Tracker `Reminders_UI`
  - [x] 10.1 Implement push subscribe helper
    - Create `tracker/src/push/subscribe.ts` with `urlBase64ToUint8Array(VAPID_PUBLIC_KEY)` and `subscribePush(): Promise<PushSubscription>` calling `Notification.requestPermission()` then `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
    - On `denied`: throw a typed error consumable by the UI for the `izinkan_notifikasi` message
    - _Requirements: 5.2, 5.3, 5.7, 5.8_

  - [x] 10.2 Implement Push_Service client
    - Create `tracker/src/push/client.ts` with typed methods: `getSettings(idToken)`, `postSettings(idToken, body)`, `postSubscribe(idToken, subscription)`, `deleteSubscribe(idToken, endpoint)`, `postDispatchTest(idToken)`
    - All requests use `Authorization: Bearer ${idToken}` and target `import.meta.env.VITE_PUSH_SERVICE_URL`
    - _Requirements: 5.4, 6.2, 6.6, 10.1_

  - [x] 10.3 Implement `RemindersScreen` component
    - Create `tracker/src/components/RemindersScreen.tsx`
    - On mount: call `getSettings`. If `{ configured: false }`, prefill `08:00` and `Intl.DateTimeFormat().resolvedOptions().timeZone`; if `{ configured: true, time, timezone }`, prefill those values
    - "aktifkan pengingat" button: call `subscribePush`, then `postSubscribe`. On `denied` permission, show `izinkan notifikasi di pengaturan browser`; do not show that message while permission is `granted`
    - "simpan jam pengingat" button: call `postSettings` with `{ time: 'HH:MM', timezone: '<IANA>' }`
    - "kirim notifikasi tes" button: call `postDispatchTest`
    - Visible only to a signed-in Owner_Account session (`status === 'signed-in'`)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7, 5.8, 6.1, 6.2, 6.6, 10.1, 10.4_

  - [x]* 10.4 Write unit tests for `RemindersScreen`
    - Test `configured: false` prefills `08:00` and resolved tz, `configured: true` round-trips values
    - Test denied permission shows i18n message and keeps button visible
    - Test "kirim notifikasi tes" hits `/dispatch/test`
    - _Requirements: 5.1, 5.7, 5.8, 6.1, 6.6, 10.4_

- [x] 11. Wire the Tracker app shell and routing
  - [x] 11.1 Implement minimal route handling and `App` shell
    - Create `tracker/src/App.tsx` reading `?route=form` (and default) from `location.search`; render `SignIn` when `status !== 'signed-in'`, otherwise render `ActivityForm` for `route=form` and `RemindersScreen` for `route=reminders`
    - Listen for SW `NAVIGATE` `postMessage` and update route accordingly
    - Render the offline banner (`tidak ada koneksi — coba lagi nanti`) bound to `navigator.onLine`
    - _Requirements: 4.2, 6.9_

  - [x] 11.2 Wire `main.tsx` and SW registration
    - Update `tracker/src/main.tsx` to mount `<AuthProvider><App /></AuthProvider>`, call `registerServiceWorker()` on load, and mount the update toast container
    - Register SW with `navigator.serviceWorker.register('/sw.js', { scope: '/' })`
    - _Requirements: 4.2, 4.6_

- [x] 12. Checkpoint - Tracker complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Scaffold the Push_Service (Cloudflare Workers + KV)
  - [x] 13.1 Initialize Workers project in `push-service/`
    - Create `push-service/package.json` with deps `jose`, `@block65/webcrypto-web-push`, devDeps `wrangler`, `typescript`, `vitest`, `@cloudflare/vitest-pool-workers`, `fast-check`
    - Create `push-service/tsconfig.json` extending root base, target ES2022, lib `ES2022, WebWorker`, `types: ["@cloudflare/workers-types"]`
    - Create `push-service/src/index.ts` exporting `fetch(request, env, ctx)` and `scheduled(controller, env, ctx)` (delegating to a shared `dispatch` core)
    - Create `push-service/wrangler.toml` declaring `name`, `main = "src/index.ts"`, `compatibility_date`, `[triggers] crons = ["* * * * *"]`, `[[kv_namespaces]] binding = "KV"`, vars `GOOGLE_CLIENT_ID`, `OWNER_EMAIL`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` (secrets `VAPID_PRIVATE_KEY`, `DISPATCH_SECRET` documented but set via `wrangler secret put`)
    - _Requirements: 6.4, 7.1, 8.2, 9.2_

  - [x] 13.2 Configure Vitest with `@cloudflare/vitest-pool-workers`
    - Create `push-service/vitest.config.ts` using `defineWorkersConfig` with `wrangler.toml` reference and a test `KV` binding via `kvNamespaces`
    - _Requirements: 9.2_

- [x] 14. Implement Push_Service environment + response helpers
  - [x] 14.1 Implement `assertEnv`
    - Create `push-service/src/env.ts` listing required names: `GOOGLE_CLIENT_ID`, `OWNER_EMAIL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `DISPATCH_SECRET`, plus binding `KV`
    - Export `assertEnv(env)` that throws `EnvError` whose `missing` is the set of absent names; export an `Env` TypeScript type
    - In `index.ts` `fetch`: call `assertEnv` on first request after cold start (cache success in module scope); on `EnvError`, return `500` with JSON `{ error: 'misconfigured', missing: [...] }` and `Cache-Control: no-store`; log the same list via `console.error`
    - _Requirements: 9.2, 9.3_

  - [x] 14.2 Implement response helpers
    - Create `push-service/src/http.ts` with `json(status, body)` that always sets `Cache-Control: no-store` and `Content-Type: application/json`, and `forbidden()` returning `403 { error: 'forbidden' }`, `badRequest()` returning `400 { error: 'bad_request' }`, `misconfigured(missing)` returning `500 { error: 'misconfigured', missing }`
    - _Requirements: 8.4_

  - [x]* 14.3 Write property test for `assertEnv`
    - File: `push-service/tests/properties/assert-env.property.test.ts`
    - **Property 13: assertEnv reports exactly the missing required variables**
    - Generators: arbitrary subsets `M` of the required env-var name set; `numRuns: 100`
    - Assert `assertEnv` throws iff `M ≠ ∅`, with `error.missing` set-equal to `M`; assert HTTP response is `500` with JSON body `{ error: 'misconfigured', missing: [...M] }` (order-insensitive)
    - **Validates: Requirements 9.3**

  - [x]* 14.4 Write property test for global `Cache-Control: no-store`
    - File: `push-service/tests/properties/cache-control.property.test.ts`
    - **Property 12: Every Push_Service response carries Cache-Control: no-store**
    - Generators: arbitrary `(method, path, body, headers)` tuples; `numRuns: 100`
    - Assert response always includes `Cache-Control: no-store` regardless of status
    - **Validates: Requirements 8.4**

- [x] 15. Implement Push_Service KV wrapper
  - [x] 15.1 Implement KV wrapper with prefixing and JSON
    - Create `push-service/src/storage/kv.ts` with `KvStore` class wrapping `env.KV` providing `getJson<T>(key)`, `putJson(key, value)`, `delete(key)`, `listPrefix(prefix)`
    - Implement key builders: `subsKey(ownerEmail, endpointHash)` → `subs:${ownerEmail}:${endpointHash}`, `settingsKey(ownerEmail)` → `settings:${ownerEmail}`
    - Export `endpointHash(endpoint)` using WebCrypto `crypto.subtle.digest('SHA-256', ...)` and hex encoding
    - _Requirements: 5.6, 6.3_

  - [x]* 15.2 Write unit tests for `KvStore`
    - Test JSON round-trip, list-by-prefix, hex-encoded `endpointHash` is deterministic and 64 hex chars
    - _Requirements: 5.6, 6.3_

- [x] 16. Implement Push_Service ID token verification
  - [x] 16.1 Implement `verifyIdToken` with JWKS cache
    - Create `push-service/src/handlers/auth.ts` exporting `verifyIdToken(token, env, ctx): Promise<Claims>`
    - Use `jose` `createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))` cached in `caches.default` for 12h via a manual fetch wrapper
    - Call `jwtVerify(token, jwks, { algorithms: ['RS256'], audience: env.GOOGLE_CLIENT_ID, issuer: ['accounts.google.com', 'https://accounts.google.com'] })`
    - Assert `payload.email === env.OWNER_EMAIL` (lowercased) and `payload.email_verified === true`; otherwise throw `HttpError(403, 'forbidden')`
    - _Requirements: 5.5, 7.2, 7.3, 7.4_

  - [x] 16.2 Implement `requireOwnerAuth` middleware
    - Create `push-service/src/handlers/middleware.ts` exporting `requireOwnerAuth(request, env, ctx)` that extracts `Authorization: Bearer <id_token>`, calls `verifyIdToken`, returns `{ ok: true, claims }` or a `403` response (no KV mutation)
    - _Requirements: 7.2, 7.3, 7.4_

  - [x]* 16.3 Write property test for ID-token gate on mutating endpoints
    - File: `push-service/tests/properties/push-service-auth.property.test.ts`
    - **Property 5: Push_Service mutates state only on authorized requests**
    - Use a fixed RSA test key pair; vary the *claims* (signature valid/invalid, varied aud/iss/exp/email/email_verified) per design "Anti-patterns" guidance; `numRuns: 100`
    - Snapshot KV before the request; assert KV byte-equal to snapshot when any clause fails AND status is `403`; KV mutates iff every clause holds
    - **Validates: Requirements 5.5, 7.2, 7.3, 7.4**

- [x] 17. Implement Push_Service `/subscribe` and `/settings` handlers
  - [x] 17.1 Implement `POST /subscribe` and `DELETE /subscribe`
    - Create `push-service/src/handlers/subscribe.ts`
    - POST: parse body as `{ endpoint, expirationTime, keys: { p256dh, auth } }`; compute `endpointHash`; write `KvStore.putJson(subsKey(ownerEmail, endpointHash), { endpoint, expirationTime, keys, userAgent: request.headers.get('user-agent'), createdAt: new Date().toISOString() })` (overwrites if same endpoint → idempotent per Requirement 5.6)
    - DELETE: parse body `{ endpoint }`, compute `endpointHash`, call `KvStore.delete(subsKey(...))`
    - Return `200 { ok: true }`
    - _Requirements: 5.4, 5.5, 5.6_

  - [x] 17.2 Implement `GET /settings` and `POST /settings`
    - Create `push-service/src/handlers/settings.ts`
    - GET: read `settings:${ownerEmail}`; if absent return `{ configured: false }`; if present return `{ configured: true, time, timezone }`
    - POST: parse `{ time: 'HH:MM', timezone: '<IANA>' }`, validate format, write `{ time, timezone, updatedAt: new Date().toISOString() }`
    - _Requirements: 6.2, 6.3, 10.1, 10.2, 10.3_

  - [x]* 17.3 Write property test for subscription idempotence
    - File: `push-service/tests/properties/subscribe-idempotent.property.test.ts`
    - **Property 6: Subscription storage is idempotent on endpoint URL**
    - Generators: arbitrary sequences of subscription objects with biased endpoint reuse; `numRuns: 100`
    - Assert KV contains exactly one entry per distinct `endpoint`, value equals most-recent posted; n repeated posts ≡ one post
    - **Validates: Requirements 5.6**

  - [x]* 17.4 Write property test for settings last-write-wins
    - File: `push-service/tests/properties/settings-last-write.property.test.ts`
    - **Property 7: Settings storage is last-write-wins**
    - Generators: arbitrary sequences `b₁..bₙ` of `(time, timezone)` posts; `numRuns: 100`
    - Assert subsequent GET returns `{ configured: true, time: bₙ.time, timezone: bₙ.timezone }`; GET before any POST returns `{ configured: false }`
    - **Validates: Requirements 6.3, 10.2, 10.3**

- [x] 18. Implement Push_Service push sender (`web-push.ts`)
  - [x] 18.1 Implement `sendPush` via `@block65/webcrypto-web-push`
    - Create `push-service/src/push/web-push.ts` exporting `sendPush(subscription, payload, vapid): Promise<{ status: number }>`
    - Use `@block65/webcrypto-web-push` to build VAPID-signed request and `fetch` it; surface returned HTTP status (or `0` on network error)
    - VAPID config: `{ publicKey, privateKey, subject: env.VAPID_SUBJECT }`
    - _Requirements: 6.7_

  - [x]* 18.2 Write integration test for VAPID signature
    - Use `unstable_dev` or a mock push gateway intercepting outbound `fetch`; assert `Authorization: vapid t=…, k=…` header is present, parses to a JWT signed by the configured VAPID key with `sub === env.VAPID_SUBJECT` and `aud` matching the push endpoint origin
    - _Requirements: 6.7_

- [x] 19. Implement Push_Service `/dispatch` and cron
  - [x] 19.1 Implement `shouldDispatch` pure helper
    - Create `push-service/src/handlers/dispatch.ts` exporting `shouldDispatch(now: Date, settings: { time: string, timezone: string }): boolean`
    - Compute `Intl.DateTimeFormat('en-GB', { timeZone, hour12: false, hour: '2-digit', minute: '2-digit' }).format(now)` and compare to `settings.time`
    - _Requirements: 6.5_

  - [x] 19.2 Implement dispatch core and `POST /dispatch`
    - In `dispatch.ts`, implement `runDispatch(env, ctx, opts: { force?: boolean })` that loads settings, evaluates `shouldDispatch(new Date(), settings)` unless `force`, lists all subscriptions, sends pushes via `Promise.allSettled`
    - For each subscription: on response status `404` or `410` delete from KV; on 2xx and on transient 5xx/network error retain unchanged
    - Return `200 { sent, failed, removed }`
    - `POST /dispatch`: require `X-Dispatch-Secret` header, constant-time-compare to `env.DISPATCH_SECRET` (using a `safeEqual` helper); on mismatch or absence return `403` with zero pushes sent and no KV mutation
    - _Requirements: 6.4, 6.5, 6.10, 7.5, 7.6_

  - [x] 19.3 Implement `POST /dispatch/test`
    - In `dispatch.ts`, route `POST /dispatch/test` through `requireOwnerAuth` and call `runDispatch(env, ctx, { force: true })`
    - _Requirements: 6.6_

  - [x] 19.4 Wire `scheduled` handler to dispatch core
    - In `index.ts`, `scheduled(controller, env, ctx)` calls `assertEnv(env)` then `ctx.waitUntil(runDispatch(env, ctx, { force: false }))`
    - _Requirements: 6.4, 6.5_

  - [x]* 19.5 Write property test for dispatch decision
    - File: `push-service/tests/properties/dispatch-decision.property.test.ts`
    - **Property 8: Dispatch decision matches HH:MM equality in stored timezone**
    - Generators: arbitrary UTC instants, curated IANA tz list including DST zones (`Australia/Sydney`, `America/Los_Angeles`), arbitrary HH:MM strings; instants on either side of DST transitions; `numRuns: 100`
    - Assert `shouldDispatch(now, { time: t, timezone: tz })` iff `Intl.DateTimeFormat('en-GB', {...}).format(now) === t`
    - **Validates: Requirements 6.5**

  - [x]* 19.6 Write property test for dispatch cleanup of 404/410
    - File: `push-service/tests/properties/dispatch-cleanup.property.test.ts`
    - **Property 10: Dispatch removes subscriptions whose push returned 404 or 410**
    - Generators: arbitrary subscription sets `S` paired with response-status maps `r: S → status`; `numRuns: 100`
    - Mock `sendPush`; after one dispatch run assert KV contains exactly `{ s ∈ S : r(s) ∉ {404, 410} }`; transient 5xx/network errors retain
    - **Validates: Requirements 6.10**

  - [x]* 19.7 Write property test for `/dispatch` secret gate
    - File: `push-service/tests/properties/dispatch-secret.property.test.ts`
    - **Property 11: Dispatch endpoint runs iff X-Dispatch-Secret matches**
    - Generators: arbitrary header values including the exact secret, near-miss strings, and absence; `numRuns: 100`
    - Assert dispatch executes and emits messages iff header equals secret; on mismatch/absence status `403` and zero pushes sent
    - **Validates: Requirements 7.5, 7.6**

  - [x]* 19.8 Write integration test for cron wiring
    - Assert `wrangler.toml` declares `crons = ["* * * * *"]`
    - Assert `scheduled` export delegates to the same `runDispatch` core as `POST /dispatch`
    - _Requirements: 6.4_

- [x] 20. Wire Push_Service router
  - [x] 20.1 Implement request router in `index.ts`
    - In `push-service/src/index.ts`, route by `(method, pathname)`:
      - `POST /subscribe` and `DELETE /subscribe` → `requireOwnerAuth` then subscribe handlers
      - `GET /settings` and `POST /settings` → `requireOwnerAuth` then settings handlers
      - `POST /dispatch` → `X-Dispatch-Secret` gate then `runDispatch`
      - `POST /dispatch/test` → `requireOwnerAuth` then `runDispatch({ force: true })`
      - Anything else → `404 { error: 'not_found' }` with `Cache-Control: no-store`
    - On any thrown `HttpError`, render via `json(status, body)`
    - On malformed JSON: `400 { error: 'bad_request' }`
    - _Requirements: 5.4, 5.5, 6.2, 6.4, 6.6, 7.2, 7.3, 7.4, 7.5, 7.6, 8.4, 10.1_

- [x] 21. Checkpoint - Push_Service complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 22. End-to-end and deployment configurations
  - [x] 22.1 Add Tracker build / deploy config
    - Add `tracker/package.json` scripts: `dev`, `build` (Vite), `preview`, `test:unit`, `test:property`, `test:property:long` (numRuns=1000), `test:e2e`
    - Document HTTPS hosting via Cloudflare Pages / Vercel / Netlify in `tracker/README.md` (no mixed content; all script/style/icon URLs HTTPS)
    - _Requirements: 8.1, 8.3_

  - [x] 22.2 Add Push_Service deploy scripts
    - Add `push-service/package.json` scripts: `dev` (`wrangler dev`), `deploy` (`wrangler deploy`), `test`, `test:property`, `test:integration`, `secret:vapid` (`wrangler secret put VAPID_PRIVATE_KEY`), `secret:dispatch` (`wrangler secret put DISPATCH_SECRET`)
    - Document `wrangler kv:namespace create KV` in `push-service/README.md` and how to wire the resulting binding ID back into `wrangler.toml`
    - _Requirements: 8.2, 9.2_

  - [x] 22.3 Add root convenience scripts and CI policy file
    - Root `package.json` scripts: `test`, `test:unit`, `test:property`, `test:property:long`, `test:integration`, `test:e2e`, `build`
    - Create `.github/workflows/ci.yml` running unit + property on every PR; integration on `push-service/` changes; nightly job for `test:property:long` and `test:e2e`
    - _Requirements: (test infrastructure for all)_

  - [x] 22.4 Implement Playwright e2e happy path
    - Add `tracker/playwright.config.ts` and `tracker/tests/e2e/happy-path.spec.ts`
    - Mock GIS module and route Calendar API + Push_Service via `page.route()`
    - Walk: open app → sign in → submit a timed activity → see confirmation → enable reminders → set time → trigger `/dispatch/test` → assert notification displayed via `page.evaluate` polling `Notification` mock
    - Add an offline smoke test that calls `context.setOffline(true)` after first load, navigates, and asserts shell renders
    - _Requirements: 1.1, 2.1, 3.1, 3.5, 4.4, 5.1, 5.2, 5.3, 5.4, 6.6, 6.8, 6.9_

- [x] 23. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP. They cover unit tests, property tests, and integration tests.
- Each task references specific requirements clauses for traceability (granular, not just user stories).
- Each property task references its property number from `design.md` §Correctness Properties and the validated requirements clauses; property tests use `fast-check` with `numRuns: 100` and live in the file paths declared in design §Testing Strategy.
- Checkpoints (tasks 7, 12, 21, 23) ensure incremental validation between major phases.
- VAPID keys are generated by task 1.2 (`pnpm vapid:generate`); the public key is baked into the Tracker bundle (build-time `VITE_VAPID_PUBLIC_KEY`) and the private key is set via `wrangler secret put VAPID_PRIVATE_KEY` (task 22.2).
- The Web App Manifest and PWA icons are produced by task 8 (manifest hand-written; icons generated from a single source SVG).
- All Bahasa Indonesia user-facing copy lives in `tracker/src/i18n/id.ts` (task 2.2) so the literals stay reviewable in one place.
- TypeScript is the implementation language for both units (declared in design — no language ambiguity).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "13.1"] },
    { "id": 2, "tasks": ["2.2", "8.1", "8.2", "13.2", "14.1", "14.2", "15.1"] },
    { "id": 3, "tasks": ["2.3", "3.1", "3.2", "8.3", "14.3", "14.4", "15.2", "16.1"] },
    { "id": 4, "tasks": ["3.3", "3.6", "4.1", "16.2", "17.1", "17.2", "18.1", "19.1"] },
    { "id": 5, "tasks": ["3.4", "3.5", "4.2", "16.3", "17.3", "17.4", "18.2", "19.2"] },
    { "id": 6, "tasks": ["4.3", "5.1", "9.1", "10.1", "10.2", "19.3", "19.4"] },
    { "id": 7, "tasks": ["4.4", "4.5", "5.2", "9.2", "9.3", "9.4", "10.3", "19.5", "19.6", "19.7", "19.8", "20.1"] },
    { "id": 8, "tasks": ["6.1", "9.5", "9.6", "10.4"] },
    { "id": 9, "tasks": ["6.2", "11.1"] },
    { "id": 10, "tasks": ["11.2"] },
    { "id": 11, "tasks": ["22.1", "22.2", "22.3"] },
    { "id": 12, "tasks": ["22.4"] }
  ]
}
```
