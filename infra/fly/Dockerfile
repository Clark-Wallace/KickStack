# KickStack Multi-Service Dockerfile for Fly.io
FROM node:18-alpine AS base

# Install dependencies
RUN apk update && apk add --no-cache \
    curl \
    wget \
    bash \
    postgresql-client \
    supervisor \
    caddy

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY api/fngw/package.json ./api/fngw/
COPY api/realtime/package.json ./api/realtime/
COPY web/package.json ./web/
COPY ai/cli/package.json ./ai/cli/

# Install Node.js dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Build stage for Functions Gateway
FROM base AS build-fngw
COPY api/fngw ./api/fngw
WORKDIR /app/api/fngw
RUN pnpm run build

# Build stage for Realtime service
FROM base AS build-realtime
COPY api/realtime ./api/realtime
WORKDIR /app/api/realtime
RUN pnpm run build

# Build stage for Web app
FROM base AS build-web
COPY web ./web
WORKDIR /app/web
RUN pnpm run build

# PostgREST binary download
FROM alpine:latest AS postgrest-bin
RUN wget -O /postgrest.tar.xz https://github.com/PostgREST/postgrest/releases/download/v12.0.2/postgrest-v12.0.2-linux-static-x64.tar.xz
RUN tar -xf /postgrest.tar.xz

# GoTrue binary download
FROM golang:1.21-alpine AS gotrue-build
RUN apk add --no-cache git make
RUN git clone https://github.com/supabase/gotrue.git /gotrue
WORKDIR /gotrue
RUN make build

# Final production stage
FROM node:18-alpine AS production

# Install system dependencies
RUN apk update && apk add --no-cache \
    curl \
    wget \
    bash \
    postgresql-client \
    supervisor \
    caddy \
    ca-certificates

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S appuser -u 1001

WORKDIR /app

# Copy built applications
COPY --from=build-fngw /app/api/fngw/dist ./api/fngw/dist
COPY --from=build-fngw /app/api/fngw/package.json ./api/fngw/
COPY --from=build-realtime /app/api/realtime/dist ./api/realtime/dist
COPY --from=build-realtime /app/api/realtime/package.json ./api/realtime/
COPY --from=build-web /app/web/.next/standalone ./web/.next/standalone
COPY --from=build-web /app/web/.next/static ./web/.next/static

# Copy binaries
COPY --from=postgrest-bin /postgrest /usr/local/bin/
COPY --from=gotrue-build /gotrue/gotrue /usr/local/bin/

# Copy configuration files
COPY infra/fly/Caddyfile /etc/caddy/Caddyfile
COPY infra/fly/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY infra/postgrest.conf /app/postgrest.conf

# Copy startup scripts
COPY infra/fly/scripts/ /app/scripts/
RUN chmod +x /app/scripts/*.sh

# Create necessary directories
RUN mkdir -p /app/logs /data
RUN chown -R appuser:nodejs /app /data

# Install production dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --prod

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Expose port
EXPOSE 80

# Switch to non-root user
USER appuser

# Start supervisor to manage all processes
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]