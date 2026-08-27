import { createRequire } from "node:module";
import { defineConfig, env } from "prisma/config";

/*
 * Prisma CLI configuration (migrate, db seed, studio).
 *
 * dotenv is loaded optionally: locally the CLI needs .env read for it
 * (Prisma 7 no longer does that automatically), but the production container
 * has no .env — Coolify injects real environment variables — and a bare
 * `import "dotenv/config"` would hard-fail there and take the startup
 * migration down with it.
 */
try {
  createRequire(import.meta.url)("dotenv/config");
} catch {
  // dotenv not installed — expected in the production image.
}

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    url: env("DATABASE_URL"),
  },
});
