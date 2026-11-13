# syntax=docker/dockerfile:1.4
# ==============================================================================
# Production Dockerfile for Cinema Ticket Reservation Service
# Multi-stage, minimal attack surface, non-root user execution
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependencies Builder
# ------------------------------------------------------------------------------
FROM node:22-alpine AS dependencies
WORKDIR /usr/src/app

# Install security updates
RUN apk update && apk upgrade --no-cache

# Install pnpm deterministically
RUN corepack enable && corepack prepare pnpm@11.12.0 --activate

# Copy package manifests
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# ------------------------------------------------------------------------------
# Stage 2: Final Production Runtime Image
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /usr/src/app

# Install wget for healthchecks and dumb-init for proper PID 1 signal forwarding
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache dumb-init wget && \
    rm -rf /var/cache/apk/*

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Copy node_modules from dependencies stage
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/

# Create data and backups directories with proper permissions for non-root user
RUN mkdir -p ./data ./backups ./evidence && \
    chown -R node:node /usr/src/app

# Security: Run as unprivileged non-root user (UID 1000)
USER node

# Expose internal service port
EXPOSE 3000

# Container Healthcheck
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

# Signal forwarding and entrypoint
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/server.js"]

