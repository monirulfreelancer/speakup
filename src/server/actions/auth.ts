"use server";

import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth, signIn } from "@/lib/auth";

/*
 * Signup and login as server actions. Plaintext passwords exist only inside
 * these functions, transiently — hashed with bcrypt (cost 12) before any
 * write, and never logged.
 */

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const signupSchema = z.object({
  name: z.string().trim().min(1, "Please tell us your name").max(100),
  email: z.email("That doesn't look like an email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.email("That doesn't look like an email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export async function signup(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const email = parsed.data.email.toLowerCase();

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { fieldErrors: { email: "An account with this email already exists" } };
  }

  const passwordHash = await hash(parsed.data.password, 12);

  // User + settings + stats in one transaction: a user without their
  // settings/stats rows would break every later phase's assumptions.
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name: parsed.data.name, passwordHash },
    });
    await tx.userSettings.create({ data: { userId: user.id } });
    await tx.userStats.create({ data: { userId: user.id } });
  });

  return signInWithCredentials(email, parsed.data.password, "/onboarding");
}

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const callbackUrl = formData.get("callbackUrl");
  const redirectTo =
    typeof callbackUrl === "string" && callbackUrl.startsWith("/")
      ? callbackUrl
      : "/dashboard";

  return signInWithCredentials(
    parsed.data.email.toLowerCase(),
    parsed.data.password,
    redirectTo,
  );
}

async function signInWithCredentials(
  email: string,
  password: string,
  redirectTo: string,
): Promise<AuthFormState> {
  try {
    await signIn("credentials", { email, password, redirectTo });
    return {};
  } catch (error) {
    // signIn redirects by throwing — that must propagate to actually navigate.
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) {
      return { error: "Email or password is incorrect" };
    }
    throw error;
  }
}

/* -------------------------------------------------------------------------
 * One email journey: check, then either password or account creation.
 * ---------------------------------------------------------------------- */

/*
 * Whether this email already has an account.
 *
 * This endpoint necessarily reveals whether an address is registered — that
 * is the point of a merged flow. What it must NOT do is leak more than the
 * user in front of it already learns from the next screen, or become a bulk
 * enumeration tool, so it is rate limited per IP and the work is constant
 * either way: the bcrypt-shaped delay below means "known" and "unknown"
 * take the same time to answer.
 */
const EMAIL_CHECKS_PER_WINDOW = 20;
const CHECK_WINDOW_MS = 10 * 60 * 1000;
const checkAttempts = new Map<string, { count: number; resetAt: number }>();

function tooManyChecks(key: string): boolean {
  const now = Date.now();
  const entry = checkAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    checkAttempts.set(key, { count: 1, resetAt: now + CHECK_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > EMAIL_CHECKS_PER_WINDOW;
}

export type EmailCheck =
  | { ok: true; known: boolean; email: string }
  | { ok: false; error: string };

export async function checkEmail(rawEmail: string): Promise<EmailCheck> {
  const parsed = z.email("That doesn't look like an email address").safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    "unknown";
  if (tooManyChecks(ip)) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const email = parsed.data.toLowerCase();
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });

  // Equalise timing: a lookup that misses returns far faster than one that
  // hits plus the bcrypt compare on the next step, which is a signal in
  // itself. This flattens the difference.
  await new Promise((resolve) => setTimeout(resolve, 120));

  return { ok: true, known: Boolean(user), email };
}

/** Kicks off the Google OAuth redirect. */
export async function signInWithGoogle(callbackUrl?: string): Promise<void> {
  await signIn("google", { redirectTo: callbackUrl || "/dashboard" });
}

/* -------------------------------------------------------------------------
 * Connecting Google to an existing account
 * ---------------------------------------------------------------------- */

/** Starts the OAuth flow for a signed-in user, returning them to Settings. */
export async function connectGoogle(): Promise<void> {
  await signIn("google", { redirectTo: "/settings" });
}

export type DisconnectResult = { ok: true } | { ok: false; error: string };

/**
 * Removes the Google link. Refuses when it would leave the account with no
 * way back in — an account with no password and no OAuth provider is
 * unreachable, and there is no password reset to recover it with.
 */
export async function disconnectGoogle(): Promise<DisconnectResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, accounts: { select: { id: true, provider: true } } },
  });
  if (!user) return { ok: false, error: "Not signed in" };

  const google = user.accounts.filter((a) => a.provider === "google");
  if (google.length === 0) return { ok: true };

  const otherProviders = user.accounts.length - google.length;
  if (!user.passwordHash && otherProviders === 0) {
    return {
      ok: false,
      error:
        "Google is the only way into this account. Set a password first, then you can disconnect it.",
    };
  }

  await db.account.deleteMany({ where: { userId: session.user.id, provider: "google" } });
  revalidatePath("/settings");
  return { ok: true };
}
