# syntax=docker/dockerfile:1
#
# SpeakUp realtime service — its own Coolify service, entirely separate from
# the Next.js app's image. Build context is the realtime/ directory.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
ENV NODE_ENV=production
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 realtime
COPY --from=deps --chown=realtime:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=realtime:nodejs /app/dist ./dist
COPY --chown=realtime:nodejs package.json ./
USER realtime
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
