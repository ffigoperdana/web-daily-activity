# Daily Activity Tracker — Front-End (PWA)

A Vite + React 18 + TypeScript Progressive Web App that logs daily activities to Google Calendar.

## Prerequisites

- Node.js 18+
- pnpm 8+

## Environment Variables

Create a `.env` file in the project root (or set these in your hosting platform's dashboard):

| Variable | Description |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID (from Google Cloud Console) |
| `VITE_OWNER_EMAIL` | The single allowed Google account email |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key (base64url) for Web Push subscription |
| `VITE_PUSH_SERVICE_URL` | Base URL of the Push_Service (e.g. `https://dat-push.workers.dev`) |

All variables are required at build time and are baked into the production bundle.

## Development

```bash
pnpm install
pnpm dev
```

This starts the Vite dev server at `http://localhost:5173` with hot module replacement.

## Build for Production

```bash
pnpm build
```

Output is written to `dist/`. The build runs TypeScript type-checking (`tsc -b`) followed by Vite's production bundler.

Preview the production build locally:

```bash
pnpm preview
```

## Testing

```bash
# Run all tests (unit + property)
pnpm test

# Unit tests only
pnpm test:unit

# Property-based tests only
pnpm test:property

# Property-based tests with extended runs (numRuns=1000)
pnpm test:property:long

# End-to-end tests (requires Playwright browsers installed)
pnpm test:e2e
```

## HTTPS Hosting

The Tracker **must** be served over HTTPS from a publicly reachable origin. This is required for:

- Service Worker registration (browsers require HTTPS)
- Web Push API (`pushManager.subscribe` requires a secure context)
- Google Identity Services (GIS requires HTTPS origins in production)

### Recommended Platforms

Any static HTTPS host works. Recommended options:

#### Cloudflare Pages

1. Connect your Git repository in the Cloudflare dashboard.
2. Set build command: `pnpm build`
3. Set build output directory: `tracker/dist`
4. Add environment variables (`VITE_GOOGLE_CLIENT_ID`, etc.) in the project settings.
5. Deploy. Cloudflare Pages serves everything over HTTPS by default.

#### Vercel

1. Import the repository and set the root directory to `tracker/`.
2. Framework preset: Vite.
3. Build command: `pnpm build`
4. Output directory: `dist`
5. Add environment variables in the project settings.
6. Deploy. Vercel provides HTTPS automatically.

#### Netlify

1. Connect the repository and set the base directory to `tracker/`.
2. Build command: `pnpm build`
3. Publish directory: `tracker/dist`
4. Add environment variables in the site settings.
5. Deploy. Netlify provides HTTPS automatically.

### No Mixed Content

All resources loaded by the Tracker use HTTPS:

- **Scripts and styles** — bundled by Vite into relative paths served from the same HTTPS origin.
- **Icons and manifest** — referenced via relative paths (`/icons/icon-192.png`, `/manifest.webmanifest`).
- **Google Identity Services** — loaded from `https://accounts.google.com/gsi/client`.
- **Google Calendar API** — called at `https://www.googleapis.com/calendar/v3/...`.
- **Push_Service API** — configured via `VITE_PUSH_SERVICE_URL` which must be an HTTPS URL.

No HTTP resources are loaded. There is no mixed content.
