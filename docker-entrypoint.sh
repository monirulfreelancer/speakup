#!/bin/sh
#
# Container entrypoint: apply pending migrations, THEN start the server.
#
# FAILURE BEHAVIOUR: FAIL CLOSED. A failed migration exits non-zero and
# `node server.js` is never reached — the container dies instead of serving
# traffic against a half-migrated schema. Coolify reports the deploy as
# failed and keeps the previous container running.
#
# `prisma migrate deploy` is idempotent: it applies only what has not been
# applied and is a no-op otherwise, so running it on every start is safe.

set -eu

echo "[entrypoint] Applying database migrations..."

# Run from /prisma-cli: prisma.config.ts imports "prisma/config", which only
# resolves from that directory's node_modules. The CLI is invoked by file
# path — .bin symlinks don't reliably survive multi-stage COPY.
if ! (cd /prisma-cli && node node_modules/prisma/build/index.js migrate deploy); then
  echo "[entrypoint] MIGRATION FAILED. Refusing to start the server."       >&2
  echo "[entrypoint] The database may be unreachable or a migration may be" >&2
  echo "[entrypoint] invalid. Fix the cause and redeploy."                  >&2
  exit 1
fi

echo "[entrypoint] Migrations up to date. Starting server..."
exec node server.js
