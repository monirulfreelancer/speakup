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

  /*
   * AI practice visibility. Deliberately NOT a NEXT_PUBLIC_ variable:
   * those are inlined at build time, and this must be flippable from the
   * Coolify dashboard with a restart and no rebuild.
   *
   * Optional, and absent means HIDDEN. Anything other than "true"/"1" is
   * treated as off rather than rejected, so a typo can never stop the app
   * from booting.
   */
  AI_MODE_ENABLED: z
    .string()
    .optional()
    .transform((v) => v?.toLowerCase() === "true" || v === "1"),

  /*
   * Google sign-in. OPTIONAL: the app must boot without them, and the
   * Google button simply is not rendered when either is missing.
   */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

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
