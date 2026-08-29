import Link from "next/link";
import { redirect } from "next/navigation";
import { Mic } from "lucide-react";
import { auth, googleEnabled } from "@/lib/auth";
import { AuthFlow } from "./auth-flow";

export const metadata = { title: "Sign in — SpeakUp" };

/*
 * One page for signing in AND signing up: the email step decides which it
 * is, so nobody has to know which button they were supposed to press.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { callbackUrl, error } = await searchParams;

  // Auth.js reports a Google sign-in whose email already has a password
  // account as OAuthAccountNotLinked. Translate it into something a person
  // can act on.
  const oauthError =
    error === "OAuthAccountNotLinked"
      ? "This email already has a password. Sign in with your password, then connect Google from Settings."
      : error
        ? "That sign-in did not work. Please try again."
        : undefined;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-on-primary">
            <Mic className="size-7" aria-hidden />
          </span>
          <h1 className="text-2xl">Welcome to SpeakUp</h1>
          <p className="text-sm text-muted">Sign in, or create an account in one step.</p>
        </div>

        <AuthFlow
          callbackUrl={callbackUrl}
          googleEnabled={googleEnabled}
          oauthError={oauthError}
        />

        <p className="text-center text-xs text-muted">
          By continuing you agree to our{" "}
          <Link href="/guidelines" className="underline underline-offset-4">
            community guidelines
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
