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
