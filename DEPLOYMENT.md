# Deployment Guide

## Architecture Overview

```
GitHub (public repo)
    │
    ├── push to main
    │
    ▼
Jenkins (https://jenkins.fgdev.tech)
    │
    ├── Run tests (unit, lint)
    ├── Build tracker
    │
    ├──► Deploy Tracker ──► Coolify API (100.69.245.47:8000)
    │                            │
    │                            ▼
    │                       Coolify builds Docker image
    │                       from Dockerfile in repo
    │                            │
    │                            ▼
    │                       Container running (nginx + static PWA)
    │                            │
    │                            ▼
    │                       daily.fgdev.tech
    │                       (Cloudflare → Oracle Caddy → WireGuard → SafeLine → Coolify)
    │
    └──► Deploy Push_Service ──► Cloudflare Workers (wrangler deploy)
                                     │
                                     ▼
                                 dat-push-service.workers.dev
```

## Prerequisites

- Jenkins with Node.js 20 tool configured (named `node-20`)
- Coolify running on Oracle VPS (accessible via Tailscale at `100.69.245.47:8000`)
- Cloudflare account with Workers enabled
- GitHub public repository

## Jenkins Setup

### 1. Install Required Plugins

- **NodeJS Plugin** — for managing Node.js installations
- **Pipeline** — for Jenkinsfile support
- **Credentials** — for secret management

### 2. Configure Node.js Tool

Go to **Manage Jenkins → Tools → NodeJS installations**:
- Name: `node-20`
- Version: 20.x
- Install automatically: Yes

### 3. Add Credentials

Go to **Manage Jenkins → Credentials → System → Global credentials**:

| ID | Type | Description |
|---|---|---|
| `coolify-api-token` | Secret text | Coolify API token (from Coolify Settings → API) |
| `coolify-app-uuid` | Secret text | UUID of the Tracker app in Coolify |
| `cloudflare-api-token` | Secret text | Cloudflare API token with Workers write permission |
| `vite-google-client-id` | Secret text | Google OAuth client ID |
| `vite-owner-email` | Secret text | Owner email address |
| `vite-vapid-public-key` | Secret text | VAPID public key (base64url) |
| `vite-push-service-url` | Secret text | Push Service URL (e.g., `https://dat-push-service.workers.dev`) |

### 4. Create Pipeline Job

1. **New Item → Pipeline**
2. Name: `daily-activity-tracker`
3. **Pipeline → Definition**: Pipeline script from SCM
4. **SCM**: Git
5. **Repository URL**: `https://github.com/<your-username>/web-daily-activity.git`
6. **Branch**: `*/main`
7. **Script Path**: `Jenkinsfile`
8. **Poll SCM** (optional): `H/5 * * * *` (check every 5 minutes)

Or use a **GitHub webhook** to trigger on push:
- In GitHub repo → Settings → Webhooks → Add webhook
- Payload URL: `https://jenkins.fgdev.tech/github-webhook/`
- Content type: `application/json`
- Events: Just the push event

## Coolify Setup

### 1. Create Application

1. Open Coolify at `http://100.69.245.47:8000`
2. **New Resource → Application**
3. Source: **Public Repository**
4. Repository URL: `https://github.com/<your-username>/web-daily-activity.git`
5. Branch: `main`
6. Build Pack: **Dockerfile**
7. Dockerfile Location: `/Dockerfile`

### 2. Configure Environment Variables

The Dockerfile copies `.env` from the repo root into the build context. Vite reads `VITE_*` vars from this file during `vite build`.

**Option A: Commit `.env` to the repo** (fine for public vars like client IDs — these get baked into the JS bundle anyway and are visible to anyone inspecting the PWA):

```env
VITE_GOOGLE_CLIENT_ID=<your-client-id>
VITE_OWNER_EMAIL=<your-email>
VITE_VAPID_PUBLIC_KEY=<your-vapid-public-key>
VITE_PUSH_SERVICE_URL=https://dat-push-service.workers.dev
```

**Option B: Use Coolify's "Build Environment Variables"** feature to inject them at build time (Coolify writes them to the build context). In that case, update the Dockerfile to use `ARG` instead of `COPY .env`.

### 3. Configure Domain

In Coolify app settings → **Settings**:
- Domain: `daily.fgdev.tech`
- Port: `80`

### 4. Disable Auto-Deploy

Since Jenkins triggers deploys:
- Uncheck **Auto Deploy** in Coolify app settings

### 5. Get API Token and App UUID

**API Token:**
- Coolify → Settings → API → Generate Token
- Save as Jenkins credential `coolify-api-token`

**App UUID:**
- Coolify → Your App → Settings → look for the UUID in the URL or settings panel
- Save as Jenkins credential `coolify-app-uuid`

## Cloudflare Workers Setup (Push_Service)

### 1. Create API Token

1. Cloudflare Dashboard → My Profile → API Tokens
2. Create Token → Custom Token
3. Permissions: `Account > Workers Scripts > Edit`
4. Save as Jenkins credential `cloudflare-api-token`

### 2. Create KV Namespace

```bash
cd push-service
npx wrangler kv:namespace create KV
```

Update `wrangler.toml` with the returned namespace ID.

### 3. Set Secrets

```bash
cd push-service
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put DISPATCH_SECRET
```

### 4. Configure Vars

Edit `push-service/wrangler.toml`:

```toml
[vars]
GOOGLE_CLIENT_ID = "<your-client-id>"
OWNER_EMAIL = "<your-email>"
VAPID_PUBLIC_KEY = "<your-vapid-public-key>"
VAPID_SUBJECT = "mailto:<your-email>"
```

### 5. First Deploy (manual)

```bash
cd push-service
CLOUDFLARE_API_TOKEN=<your-token> npx wrangler deploy
```

After this, Jenkins handles subsequent deploys automatically when `push-service/` files change.

## Domain & Network Flow

```
User browser
    │
    ▼
daily.fgdev.tech (Cloudflare DNS → proxied)
    │
    ▼
Oracle VPS public IP (Caddy reverse proxy)
    │
    ▼
WireGuard/Tailscale tunnel
    │
    ▼
SafeLine WAF
    │
    ▼
Coolify container (nginx:alpine on port 80)
    │
    ▼
Static PWA served
```

## Coolify API Reference

The Jenkinsfile uses the Coolify v1 API to trigger deploys:

```bash
# Trigger redeploy
curl -X POST http://100.69.245.47:8000/api/v1/deploy \
  -H "Authorization: Bearer <COOLIFY_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"uuid": "<APP_UUID>", "force_rebuild": true}'
```

## Troubleshooting

### Build fails in Coolify
- Check build arguments are set correctly
- Verify the Dockerfile builds locally: `docker build --build-arg VITE_GOOGLE_CLIENT_ID=test ...`

### Push_Service deploy fails
- Verify `CLOUDFLARE_API_TOKEN` has Workers write permission
- Check `wrangler.toml` has correct KV namespace ID

### Jenkins can't reach Coolify
- Verify Tailscale is connected on both machines
- Test: `curl http://100.69.245.47:8000/api/v1/version -H "Authorization: Bearer <token>"`

### Service Worker not updating
- The nginx config sets `Cache-Control: no-store` on `/sw.js`
- Users will see the "versi baru tersedia" toast on next visit after deploy
