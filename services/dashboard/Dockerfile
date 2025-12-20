# syntax=docker/dockerfile:1.4

# ============================================
# Dashboard Dockerfile
# Multi-stage build for Next.js application
# ============================================

FROM node:20-alpine AS base
RUN corepack enable pnpm

# ============================================
# Dependencies Stage
# ============================================
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/shared/package.json ./services/shared/
COPY services/dashboard/package.json ./services/dashboard/

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ============================================
# Builder Stage
# ============================================
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/shared/node_modules ./services/shared/node_modules
COPY --from=deps /app/services/dashboard/node_modules ./services/dashboard/node_modules

# Copy source
COPY . .

# Build shared library first
WORKDIR /app/services/shared
RUN pnpm build

# Build dashboard
WORKDIR /app/services/dashboard
RUN pnpm build

# ============================================
# Production Stage
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/services/dashboard/.next/standalone ./
COPY --from=builder /app/services/dashboard/.next/static ./services/dashboard/.next/static
COPY --from=builder /app/services/dashboard/public ./services/dashboard/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "services/dashboard/server.js"]
