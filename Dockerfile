# syntax=docker/dockerfile:1
#
# SpeakUp — production image for Coolify.
#
# Multi-stage so the shipped image contains only what is needed to RUN the
# app: no source, no dev dependencies, no build cache. Built on top of
# `output: "standalone"` in next.config.ts.

# ---------------------------------------------------------------------------
# 1. deps — install node_modules once, cached until package files change
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Force devDependencies in: Coolify passes NODE_ENV=production as a build ARG,
# which would otherwise make pnpm skip the dev deps that the BUILD needs
# (TypeScript, Tailwind, the Prisma CLI). The runtime stage sets its own
# NODE_ENV=production, so nothing leaks into the shipped image.
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile --prod=false

# ---------------------------------------------------------------------------
# 2. builder — produce .next/standalone
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN corepack enable pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Build-time placeholders — never used to connect to anything. prisma.config.ts
# reads DATABASE_URL through Prisma's env() helper, which THROWS if the
# variable is missing; `prisma generate` and `next build` only need it to
# parse. Real values are injected by Coolify at runtime. NEXTAUTH_* are here
# for the same reason: src/lib/env.ts validates at import time.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV NEXTAUTH_SECRET="build-placeholder-secret-not-used-at-runtime"

# Generate the Prisma client here: src/generated is in .dockerignore (a local
# copy would be built for the wrong platform), so COPY . . does not bring it.
RUN pnpm prisma generate

RUN pnpm build

# ---------------------------------------------------------------------------
# 3. migrator — a self-contained Prisma CLI for the runtime image
#
# Copying node_modules/prisma out of the builder does NOT work: package
# managers hoist transitive dependencies unpredictably, so pieces like
# `effect` (required by @prisma/config) get left behind and the CLI dies at
# runtime with "Cannot find module". Installing the CLI cleanly in its own
# stage produces a complete dependency tree. The version is read from
# package.json so CLI and client can never drift apart.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS migrator
WORKDIR /migrator
RUN apk add --no-cache libc6-compat

# Copied under a different name on purpose: as package.json it would make npm
# install the app's entire dependency list. Read for the version, then removed.
COPY package.json ./app-package.json
RUN PRISMA_VERSION="$(node -p "require('./app-package.json').devDependencies.prisma")" \
 && rm ./app-package.json \
 && npm init -y > /dev/null \
 && npm install --no-audit --no-fund "prisma@${PRISMA_VERSION}" \
 && npm cache clean --force

# ---------------------------------------------------------------------------
# 4. runner — the image that actually ships
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# The Prisma CLI lives in its OWN directory, never merged into the app's
# node_modules: pnpm's standalone output uses symlinks into a .pnpm store,
# and overlaying a second real tree onto it makes the COPY fail with
# "cannot replace directory with file". The entrypoint invokes the CLI by
# absolute path instead.
COPY --from=migrator --chown=nextjs:nodejs /migrator/node_modules /prisma-cli/node_modules

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Schema, migrations and CLI config live NEXT TO the CLI, not in /app:
# prisma.config.ts imports "prisma/config", which Node can only resolve from
# a node_modules that actually contains the prisma package — /prisma-cli's.
# The entrypoint runs the CLI from that directory.
COPY --from=builder --chown=nextjs:nodejs /app/prisma /prisma-cli/prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts /prisma-cli/prisma.config.ts

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# start-period is generous because the container applies migrations before it
# listens; a first deploy against an empty database should not be killed
# mid-migration.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# ENTRYPOINT, not CMD: migrations must run before the server starts, every
# time, and must not be skippable by passing a different command.
ENTRYPOINT ["./docker-entrypoint.sh"]
