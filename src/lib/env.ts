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

  // AI partner mode. Keys stay optional so the app boots without them —
  // the practice API returns a clear 503 instead.
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(["anthropic", "openai"]).default("anthropic"),
  AI_MODEL: z.string().optional(),
  DAILY_MINUTES_QUOTA: z.coerce.number().int().positive().default(60),

  // TURN (coturn) for WebRTC. All optional: without TURN_SECRET the app
  // falls back to STUN only, which works on most home networks and fails on
  // symmetric NAT — degraded, not broken, so it must never block boot.
  TURN_SECRET: z.string().optional(),
  TURN_URLS: z.string().optional(),
  TURN_REALM: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${details}`);
}

export const env = parsed.data;
