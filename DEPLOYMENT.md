# Deployment Guide

## Architecture Overview

```
GitHub (public repo)
    │
    ├── push to main
    │
    ├──► GitHub Actions (CI)
    │       └── Unit tests + property tests + integration tests
    │
    └──► Jenkins (CD) via webhook
            │
            ├── Lint + Unit tests
            │
            ├──► Deploy Tracker
            │       └── Coolify API (http://coolify:8080 internal)
            │               └── Build Dockerfile → nginx container
            │                       └── daily.fgdev.tech
            │
            └──► Deploy Push_Service (if push-service/ changed)
                    └── wrangler deploy → Cloudflare Workers
                            └── dat-push-service.perdanaputrafigo.workers.dev
```

## Network Topology

```
User browser
    │
    ▼
daily.fgdev.tech (Cloudflare DNS, proxied)
    │
    ▼
Oracle VPS (Caddy reverse proxy)
    │
    ▼
WireGuard / Tailscale tunnel
    │
    ▼
SafeLine WAF
    │
    ▼
Coolify container (nginx:alpine, port 80)
    │
    ▼
Static PWA served
```

## CI/CD Pipeline

### GitHub Actions (`.github/workflows/ci.yml`)

Runs on every push/PR to `main`:
- **Unit & Property Tests** — runs `pnpm test:unit` and `pnpm test:property` for both packages
- **Integration Tests** — runs only when `push-service/` files change
- **Nightly** — runs long property tests (numRuns=1000) and Playwright e2e on schedule (02:00 UTC)

### Jenkins (`Jenkinsfile`)

Triggered by GitHub webhook on push to `main`:

| Stage | What it does |
|---|---|
| Checkout | Pull latest code from GitHub |
| Install | `corepack enable` + `pnpm install` |
| Lint | `pnpm lint` (Prettier check) |
| Test | Unit tests for Tracker + Push_Service (parallel) |
| Deploy Tracker | Trigger Coolify redeploy via API |
| Deploy Push_Service | `wrangler deploy` (only if `push-service/` changed) |

## Jenkins Setup

### Prerequisites

- Jenkins running in Coolify (Docker container)
- Jenkins connected to `coolify` Docker network
- NodeJS Plugin installed + `node-20` tool configured
- Multibranch Scan Webhook Trigger plugin installed

### Job Configuration

- **Type:** Multibranch Pipeline
- **Branch Source:** GitHub (public repo URL)
- **Build Configuration:** Jenkinsfile
- **Scan Trigger:** Scan by webhook, token: `web-daily-activity`

### GitHub Webhook

- **URL:** `https://jenkins.fgdev.tech/multibranch-webhook-trigger/invoke?token=web-daily-activity`
- **Content type:** `application/json`
- **Events:** Push only

### Jenkins Credentials

| ID | Type | Value |
|---|---|---|
| `coolify-api-token` | Secret text | Coolify API token (Settings → API → Generate) |
| `coolify-app-uuid` | Secret text | UUID of the Tracker app in Coolify |
| `cloudflare-api-token` | Secret text | Cloudflare API token (Workers Scripts → Edit permission) |

### Node.js Tool

- Manage Jenkins → Tools → NodeJS installations
- Name: `node-20`
- Version: NodeJS 20.x (auto-install)

## Coolify Setup

### Tracker Application

| Setting | Value |
|---|---|
| Source | Public GitHub repo |
| Build Pack | Dockerfile |
| Dockerfile Location | `/Dockerfile` |
| Base Directory | `/` |
| Ports Exposes | `80` |
| Domain | `http://daily.fgdev.tech:80` |
| Auto Deploy | Disabled (Jenkins triggers) |

### Environment Variables (Production)

Set in Coolify → app → Environment Variables. Check **"Use Docker Build Secrets"**.

```
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>.apps.googleusercontent.com
VITE_OWNER_EMAIL=<your-email>@gmail.com
VITE_VAPID_PUBLIC_KEY=<your-vapid-public-key>
VITE_PUSH_SERVICE_URL=https://dat-push-service.<subdomain>.workers.dev
```

These are injected as Docker build ARGs during `docker build`.

### Coolify API Access from Jenkins

Jenkins container reaches Coolify via Docker internal network:
- URL: `http://coolify:8080/api/v1`
- Both containers must be on the same Docker network (`coolify`)

## Cloudflare Workers Setup (Push_Service)

### Deploy

```bash
cd push-service
npx wrangler login        # one-time auth
npx wrangler deploy       # deploy to edge
```

### KV Namespace

```bash
npx wrangler kv:namespace create KV
# Update wrangler.toml with the returned ID
```

### Secrets

```bash
npx wrangler secret put VAPID_PRIVATE_KEY    # paste private key
npx wrangler secret put DISPATCH_SECRET      # paste random string
```

### Configuration (`push-service/wrangler.toml`)

```toml
[vars]
GOOGLE_CLIENT_ID = "<same as VITE_GOOGLE_CLIENT_ID>"
OWNER_EMAIL = "<same as VITE_OWNER_EMAIL>"
VAPID_PUBLIC_KEY = "<same as VITE_VAPID_PUBLIC_KEY>"
VAPID_SUBJECT = "mailto:<your-email>"
```

### Cloudflare API Token (for Jenkins auto-deploy)

1. Cloudflare Dashboard → My Profile → API Tokens → Create Token
2. Permission: Account → Workers Scripts → Edit
3. Save token as Jenkins credential `cloudflare-api-token`

## Dockerfile

Multi-stage build:
1. **Builder stage** (node:20-alpine): installs pnpm, copies workspace, builds Vite app with env vars injected as ARGs
2. **Production stage** (nginx:alpine): copies built `dist/` to nginx, serves as SPA with custom config

## Troubleshooting

### Jenkins pipeline fails at Deploy (Coolify)
- Verify Jenkins container is on `coolify` Docker network
- Test from Jenkins terminal: `curl http://coolify:8080/api/v1/version`
- Check `coolify-api-token` credential is valid

### Coolify build fails
- Check "Use Docker Build Secrets" is enabled
- Verify all 4 `VITE_*` env vars are set in Coolify
- Check Dockerfile builds locally: `docker build .`

### Push_Service deploy fails
- Verify `cloudflare-api-token` has Workers Scripts Edit permission
- Check `wrangler.toml` has valid KV namespace ID
- Run `npx wrangler whoami` to verify auth

### CORS errors in browser
- Push_Service must include `Access-Control-Allow-Origin` header
- Allowed origins: `https://daily.fgdev.tech`, `http://localhost:5173`

### Service Worker not registering
- SW file must be at `/service-worker.js` (not `/sw.js`)
- Check DevTools → Application → Service Workers
- Clear site data and reload after deploy
