"use server";

import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import { db } from "@/lib/db";
import { signIn } from "@/lib/auth";

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
