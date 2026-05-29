# Push Service

A Cloudflare Worker that stores Web Push subscriptions, manages reminder settings, and dispatches VAPID-signed push notifications for the Daily Activity Tracker.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)
- A [Cloudflare](https://dash.cloudflare.com/) account with Workers enabled
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (installed as a dev dependency)

## Local Development

```bash
pnpm install
pnpm dev
```

This runs `wrangler dev` which starts a local development server with hot reload. The worker will be available at `http://localhost:8787` by default.

## Deployment

### 1. Create the KV Namespace

Before deploying for the first time, create the KV namespace used for subscription and settings storage:

```bash
npx wrangler kv:namespace create KV
```

This outputs something like:

```
Add the following to your configuration file in your kv_namespaces array:
{ binding = "KV", id = "abc123def456..." }
```

Copy the `id` value and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "KV"
id = "<paste-your-namespace-id-here>"
```

For a preview (dev) namespace, also create:

```bash
npx wrangler kv:namespace create KV --preview
```

And add the resulting `preview_id` to the same binding in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "KV"
id = "<production-namespace-id>"
preview_id = "<preview-namespace-id>"
```

### 2. Set Secrets

Set the VAPID private key (used to sign push messages):

```bash
pnpm secret:vapid
```

Set the dispatch secret (shared secret for the cron-triggered dispatch endpoint):

```bash
pnpm secret:dispatch
```

Both commands will prompt you to enter the secret value interactively.

### 3. Configure Environment Variables

Edit `wrangler.toml` and fill in the `[vars]` section:

```toml
[vars]
GOOGLE_CLIENT_ID = "your-google-client-id.apps.googleusercontent.com"
OWNER_EMAIL = "your-email@gmail.com"
VAPID_PUBLIC_KEY = "your-base64url-encoded-vapid-public-key"
VAPID_SUBJECT = "mailto:your-email@gmail.com"
```

### 4. Deploy

```bash
pnpm deploy
```

This runs `wrangler deploy` which publishes the worker to Cloudflare's edge network.

## Environment Variables

### Public Variables (`[vars]` in `wrangler.toml`)

| Variable           | Purpose                                                          |
| ------------------ | ---------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID used to verify ID tokens (audience claim) |
| `OWNER_EMAIL`      | The single allowed Google account email address                  |
| `VAPID_PUBLIC_KEY` | VAPID public key for signing push messages                       |
| `VAPID_SUBJECT`    | VAPID subject identifier, typically `mailto:<owner-email>`       |

### Secrets (set via `wrangler secret put`)

| Secret              | Purpose                                                                           |
| ------------------- | --------------------------------------------------------------------------------- |
| `VAPID_PRIVATE_KEY` | Private key for signing VAPID JWTs (never exposed to the browser)                 |
| `DISPATCH_SECRET`   | Shared secret required by `POST /dispatch` to authorize cron-triggered push sends |

### KV Binding

| Binding | Purpose                                                                  |
| ------- | ------------------------------------------------------------------------ |
| `KV`    | Cloudflare KV namespace storing push subscriptions and reminder settings |

## Scripts

| Script                  | Command                                 | Description                      |
| ----------------------- | --------------------------------------- | -------------------------------- |
| `pnpm dev`              | `wrangler dev`                          | Start local development server   |
| `pnpm deploy`           | `wrangler deploy`                       | Deploy to Cloudflare Workers     |
| `pnpm test`             | `vitest --run`                          | Run all tests                    |
| `pnpm test:property`    | `vitest --run tests/properties`         | Run property-based tests only    |
| `pnpm test:integration` | `vitest --run tests/integration`        | Run integration tests only       |
| `pnpm secret:vapid`     | `wrangler secret put VAPID_PRIVATE_KEY` | Set the VAPID private key secret |
| `pnpm secret:dispatch`  | `wrangler secret put DISPATCH_SECRET`   | Set the dispatch secret          |

## API Endpoints

| Method   | Path             | Auth                       | Purpose                             |
| -------- | ---------------- | -------------------------- | ----------------------------------- |
| `POST`   | `/subscribe`     | Bearer ID token            | Store a Web Push subscription       |
| `DELETE` | `/subscribe`     | Bearer ID token            | Remove a subscription               |
| `GET`    | `/settings`      | Bearer ID token            | Read reminder time and timezone     |
| `POST`   | `/settings`      | Bearer ID token            | Save reminder time and timezone     |
| `POST`   | `/dispatch`      | `X-Dispatch-Secret` header | Cron-triggered push dispatch        |
| `POST`   | `/dispatch/test` | Bearer ID token            | Force-send a test push notification |

## Generating VAPID Keys

From the repository root:

```bash
pnpm vapid:generate
```

Or manually:

```bash
npx web-push generate-vapid-keys --json
```

Copy the `publicKey` to both `VITE_VAPID_PUBLIC_KEY` (Tracker) and `VAPID_PUBLIC_KEY` (Push Service vars), and set the `privateKey` via `pnpm secret:vapid`.
