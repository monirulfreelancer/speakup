# SpeakUp

A PWA for practicing spoken English — with an AI partner now, and real people later.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 + shadcn/ui · Prisma 7 · PostgreSQL · pnpm. Deployed via GitHub → Coolify (Docker) on a self-hosted VPS.

## Local setup

Requirements: Node 22, pnpm, Docker.

```bash
pnpm install
cp .env.example .env        # defaults work for local dev
pnpm db:start               # Postgres in Docker on host port 5434
pnpm db:migrate             # apply migrations
pnpm dev                    # http://localhost:3000
```

Check the app is healthy: `curl localhost:3000/api/health` → `{"status":"ok","db":true,...}`.

Useful scripts:

| Command | What it does |
| --- | --- |
| `pnpm db:start` / `pnpm db:stop` | Start/stop the local Postgres container |
| `pnpm db:migrate` | Create/apply migrations in development |
| `pnpm db:studio` | Browse the data |
| `pnpm typecheck` | TypeScript check |
| `pnpm build` | Production build (standalone output) |

## Production build (Docker)

```bash
docker build -t speakup .
```

The image applies `prisma migrate deploy` on start (see `docker-entrypoint.sh`) **before** the server listens. A failed migration exits the container — fail closed, never serve against a half-migrated schema.

## Deploying on Coolify

1. **Create the PostgreSQL resource** in Coolify (one-click Postgres). Copy its *internal* connection string.
2. **Create the application** from this GitHub repo. Build pack: Dockerfile. Port: **3000**.
3. **Environment variables** (see `.env.example`):
   - `DATABASE_URL` — the internal Postgres connection string
   - `NEXTAUTH_URL` — the public URL of the app
   - `NEXTAUTH_SECRET` — `openssl rand -base64 32`; mark **"Available at Buildtime" unchecked** (build args are baked into image layers)
4. **Healthcheck path:** `/api/health`.
5. Enable **auto-deploy** from the `master` branch.
6. Add the domain and let Coolify provision HTTPS.

Migrations run automatically on every container start; they are idempotent, so redeploys with no schema changes are a no-op.

## Realtime service (`realtime/`)

Human-mode matching runs in a separate, self-contained Node service —
Express + Socket.io + plain `pg`. It never imports from the Next.js app and
never runs migrations; the web app owns the schema, and the service reads and
writes the matching tables (`match_queue`, `matches`, `blocks`, plus reads of
`topics`) with SQL. The socket event contract lives in `realtime/src/events.ts`
and is mirrored byte-for-byte at `src/lib/realtime/events.ts` — change one,
change both.

Local dev:

```bash
cd realtime
npm install
DATABASE_URL="postgresql://speakup:speakup@localhost:5434/speakup" \
NEXTAUTH_SECRET="<same value as the web app's .env>" \
npm run dev
```

Environment variables:

| Variable | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | yes | Same Postgres the web app uses |
| `NEXTAUTH_SECRET` | yes | Same secret as the web app — verifies the handshake JWT minted by `/api/realtime/token` |
| `PORT` | no | Listen port (default 4000) |
| `MATCH_TIMEOUT_SECONDS` | no | Queue wait before `queue:timeout` (default 90) |
| `ALLOWED_ORIGIN` | no | CORS origin for the socket handshake — set to the web app's public URL in production (default `http://localhost:3000`) |

Deploying on Coolify: create a **second application** from this same repo with
the **build context set to `realtime/`** (Dockerfile `realtime/Dockerfile`),
port **4000**, healthcheck path `/health`. Give it the same `DATABASE_URL` and
`NEXTAUTH_SECRET` as the web app, set `ALLOWED_ORIGIN` to the web app's public
URL, give it its own domain, and set that domain as `NEXT_PUBLIC_REALTIME_URL`
on the web app. The web app's own service stays untouched.
