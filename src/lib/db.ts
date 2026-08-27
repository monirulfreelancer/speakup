import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/lib/env";

/*
 * Prisma Client singleton.
 *
 * Next.js hot-reloads modules in development, which would otherwise create a
 * new PrismaClient (and a new connection pool) on every file save until
 * Postgres refuses connections. Stashing the instance on `globalThis`
 * survives hot reloads; in production the module is evaluated once and the
 * global is unused.
 *
 * Prisma 7 requires a driver adapter — there is no built-in engine binary.
 * @prisma/adapter-pg (node-postgres) is the right one for a plain TCP
 * connection to a self-hosted Postgres.
 */

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
