import { z } from "zod";

/*
 * Environment validation. Imported by anything that reads configuration, so
 * a missing or malformed variable fails loudly at startup with the exact
 * variable named — never as a confusing undefined deep in a request.
 */

const envSchema = z.object({
  DATABASE_URL: z
    .url()
    .refine((u) => u.startsWith("postgres://") || u.startsWith("postgresql://"), {
      message: "must be a postgres:// or postgresql:// URL",
    }),
  NEXTAUTH_URL: z.url(),
  NEXTAUTH_SECRET: z.string().min(32, "must be at least 32 characters — generate with `openssl rand -base64 32`"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Optional until Phase 4 (AI partner mode).
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${details}`);
}

export const env = parsed.data;
