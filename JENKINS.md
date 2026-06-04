# Jenkins + Coolify CI/CD — Step by Step from Scratch

This guide assumes:
- Jenkins is already running in Coolify at `https://jenkins.fgdev.tech`
- Jenkins container is connected to the `coolify` Docker network
- Coolify is accessible from Jenkins at `http://coolify:8080`
- You have a new GitHub repo with a Dockerfile and want CI/CD

---

## Step 1: Create Your App in Coolify

1. Open Coolify dashboard
2. **New Resource → Application**
3. Source: **Public Repository**
4. Paste your GitHub repo URL
5. Branch: `main`
6. Build Pack: **Dockerfile**
7. Set **Ports Exposes** to match your Dockerfile (e.g., `80` for nginx)
8. Set your domain (e.g., `http://myapp.fgdev.tech:80`)
9. Add environment variables if needed (check "Use Docker Build Secrets" for build-time vars)
10. **Disable Auto Deploy** (Jenkins will trigger deploys)
11. Click Deploy once manually to verify it works
12. Note the **App UUID** — find it in the URL when viewing the app: `...service/<UUID>/...`

---

## Step 2: Get Coolify API Token

1. In Coolify sidebar → **Keys & Tokens** (or Settings → API)
2. Click **Generate** new token
3. Copy the token — you'll need it for Jenkins credentials

---

## Step 3: Create Jenkins Credentials

In Jenkins → **Manage Jenkins → Credentials → System → Global credentials → Add Credentials**:

| ID | Kind | Value |
|---|---|---|
| `coolify-api-token` | Secret text | The API token from Step 2 |
| `coolify-app-uuid` | Secret text | The UUID from Step 1 |

Add any other credentials your pipeline needs (e.g., `cloudflare-api-token` for Workers deploy).

---

## Step 4: Create Jenkinsfile in Your Repo

Create a `Jenkinsfile` at the root of your repo:

```groovy
pipeline {
    agent any

    environment {
        COOLIFY_API_URL  = 'http://coolify:8080/api/v1'
        COOLIFY_TOKEN    = credentials('coolify-api-token')
        COOLIFY_APP_UUID = credentials('coolify-app-uuid')
    }

    tools {
        nodejs 'node-20'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install') {
            steps {
                sh 'corepack enable && corepack prepare pnpm@9 --activate'
                sh 'pnpm install --frozen-lockfile || pnpm install'
            }
        }

        stage('Lint') {
            steps {
                sh 'pnpm lint'
            }
        }

        stage('Test') {
            steps {
                sh 'pnpm test'
            }
        }

        stage('Deploy') {
            steps {
                sh """
                    curl -sf -X POST \
                        "${COOLIFY_API_URL}/deploy" \
                        -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
                        -H "Content-Type: application/json" \
                        -d '{"uuid": "${COOLIFY_APP_UUID}", "force_rebuild": true}'
                """
            }
        }
    }

    post {
        success { echo '✅ Deploy successful!' }
        failure { echo '❌ Pipeline failed.' }
        always  { cleanWs() }
    }
}
```

Adjust stages to match your project (e.g., remove `pnpm` if you use `npm`).

---

## Step 5: Create Jenkins Job

1. Open Jenkins → **New Item**
2. Name: `my-project-name`
3. Type: **Multibranch Pipeline**
4. Click OK

### Configure Branch Sources:

1. Click **Add source → GitHub**
2. Repository URL: `https://github.com/your-username/your-repo.git`
3. Credentials: select your GitHub credential (or leave empty for public repos)
4. Behaviours: keep defaults (Discover branches)

### Configure Build Configuration:

1. Mode: **by Jenkinsfile**
2. Script Path: `Jenkinsfile`

### Save and let it scan.

---

## Step 6: Install Webhook Plugin

For auto-trigger on push:

1. Jenkins → **Manage Jenkins → Plugins → Available**
2. Search: `Multibranch Scan Webhook Trigger`
3. Install + restart Jenkins

---

## Step 7: Configure Webhook Trigger in Jenkins

1. Open your job → **Configure**
2. Go to **Scan Multibranch Pipeline Triggers**
3. Check **"Scan by webhook"**
4. Trigger token: `my-project-name` (any unique string)
5. Save

---

## Step 8: Add GitHub Webhook

1. Open your GitHub repo → **Settings → Webhooks → Add webhook**
2. Payload URL: `https://jenkins.fgdev.tech/multibranch-webhook-trigger/invoke?token=my-project-name`
3. Content type: `application/json`
4. Secret: leave empty
5. Events: **Just the push event**
6. Click **Add webhook**

### Verify:
- Push a commit to `main`
- Check GitHub webhook → Recent Deliveries → should show green ✓
- Check Jenkins → job should start building

---

## Step 9: Verify End-to-End

1. Make a code change
2. `git push origin main`
3. GitHub sends webhook → Jenkins starts pipeline
4. Jenkins runs lint + test
5. If pass → Jenkins calls Coolify API → Coolify rebuilds and deploys
6. Your app is live at your domain

---

## Troubleshooting

### Webhook delivered but Jenkins doesn't trigger
- Verify plugin "Multibranch Scan Webhook Trigger" is installed
- Verify trigger token matches between Jenkins config and GitHub webhook URL
- Check Jenkins logs: Manage Jenkins → System Log

### Jenkins can't reach Coolify API (timeout/connection refused)
- Jenkins container must be on the `coolify` Docker network
- Test from Jenkins terminal: `curl http://coolify:8080/api/v1/version`
- If not connected: `docker network connect coolify <jenkins-container-name>`
- Coolify internal port is `8080` (not 8000 — that's the host mapping)

### Coolify API returns 401/Unauthenticated
- Verify `coolify-api-token` credential is correct
- Regenerate token in Coolify if expired

### Coolify API returns 404 on deploy
- Verify `coolify-app-uuid` is correct
- The UUID is the service UUID, not the project UUID
- Check Coolify API docs: the endpoint might be `/applications/<uuid>/restart` depending on version

### Deploy succeeds but app doesn't update
- Check Coolify deployment logs for build errors
- Verify Dockerfile builds correctly
- Check environment variables are set in Coolify

### Node.js not found in Jenkins
- Manage Jenkins → Tools → NodeJS installations
- Add: name `node-20`, version 20.x, auto-install checked

---

## Quick Reference

| What | Where |
|---|---|
| Jenkins URL | `https://jenkins.fgdev.tech` |
| Coolify internal URL (from Jenkins) | `http://coolify:8080` |
| Coolify dashboard | `http://100.69.245.47:8000` (Tailscale) |
| Webhook URL pattern | `https://jenkins.fgdev.tech/multibranch-webhook-trigger/invoke?token=<TOKEN>` |
| Coolify deploy API | `POST http://coolify:8080/api/v1/deploy` with `{"uuid": "<APP_UUID>", "force_rebuild": true}` |

---

## Checklist for New Project

- [ ] App deployed in Coolify (manual first deploy works)
- [ ] Auto Deploy disabled in Coolify
- [ ] Coolify API token generated
- [ ] App UUID noted
- [ ] Jenkins credentials added (`coolify-api-token`, `coolify-app-uuid`)
- [ ] `Jenkinsfile` in repo root
- [ ] Jenkins Multibranch Pipeline job created
- [ ] Webhook trigger plugin installed
- [ ] "Scan by webhook" enabled with token
- [ ] GitHub webhook added with correct URL
- [ ] Test push triggers full pipeline
