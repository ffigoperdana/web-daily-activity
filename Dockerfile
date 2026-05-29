# =============================================================================
# Multi-stage Dockerfile for Daily Activity Tracker (PWA)
# Stage 1: Build the Vite app (env vars passed via ARG from Coolify)
# Stage 2: Serve static files with nginx
# =============================================================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Build-time env vars (set in Coolify → Build Environment Variables)
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_OWNER_EMAIL
ARG VITE_VAPID_PUBLIC_KEY
ARG VITE_PUSH_SERVICE_URL

# Make them available to Vite during build
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_OWNER_EMAIL=$VITE_OWNER_EMAIL
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY
ENV VITE_PUSH_SERVICE_URL=$VITE_PUSH_SERVICE_URL

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY tsconfig.base.json ./

# Copy tracker package
COPY tracker/ ./tracker/

# Copy push-service package.json (needed for workspace resolution, not built here)
COPY push-service/package.json ./push-service/package.json

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Build the tracker
RUN pnpm --filter tracker run build

# --- Stage 2: Serve ---
FROM nginx:alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Add custom nginx config for SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/tracker/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
