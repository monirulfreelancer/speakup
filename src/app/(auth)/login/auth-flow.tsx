"use client";

import { useActionState, useState, useTransition } from "react";
import { ArrowLeft } from "lucide-react";
import { checkEmail, login, signup, type AuthFormState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton } from "./google-button";

/*
 * One journey for email, in two steps.
 *
 * Step 1 asks only for the address, because at that point nobody knows
 * whether this person is new — asking for a name up front is a wall in
 * front of returning users, and asking for a password is a wall in front
 * of new ones. Step 2 becomes whichever screen is actually needed.
 *
 * The address is always shown on step 2 with a Back link, so a typo turns
 * into "that's wrong, go back" rather than a silently created stray
 * account.
 */

const initialState: AuthFormState = {};

type Step =
  | { name: "email" }
  | { name: "password"; email: string }
  | { name: "create"; email: string };

function strengthHint(password: string): { label: string; tone: string } | null {
  if (!password) return null;
  if (password.length < 8) return { label: "Too short — 8 characters minimum", tone: "text-danger" };
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if (password.length >= 12 && variety >= 3) return { label: "Strong password", tone: "text-success" };
  if (variety >= 2) return { label: "Decent password", tone: "text-warning" };
  return { label: "Weak — try adding a number or a capital", tone: "text-warning" };
}

export function AuthFlow({
  callbackUrl,
  googleEnabled,
  oauthError,
}: {
  callbackUrl?: string;
  googleEnabled: boolean;
  oauthError?: string;
}) {
  const [step, setStep] = useState<Step>({ name: "email" });
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [checking, startChecking] = useTransition();

  const [loginState, loginAction, loggingIn] = useActionState(login, initialState);
  const [signupState, signupAction, signingUp] = useActionState(signup, initialState);

  const [password, setPassword] = useState("");
  const hint = strengthHint(password);

  function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    startChecking(async () => {
      const result = await checkEmail(email).catch(() => ({
        ok: false as const,
        error: "Could not reach the server. Try again.",
      }));
      if (!result.ok) {
        setEmailError(result.error);
        return;
      }
      setEmail(result.email);
      setStep(result.known ? { name: "password", email: result.email } : { name: "create", email: result.email });
    });
  }

  function back() {
    setPassword("");
    setStep({ name: "email" });
  }

  if (step.name === "email") {
    return (
      <div className="space-y-5">
        {oauthError && (
          <p className="rounded-2xl border-2 border-danger bg-surface p-3 text-sm font-semibold text-danger">
            {oauthError}
          </p>
        )}

        {googleEnabled && (
          <>
            <GoogleButton callbackUrl={callbackUrl} />
            <div className="flex items-center gap-3">
              <span className="h-0.5 flex-1 rounded bg-line" />
              <span className="text-xs font-bold uppercase text-muted">or</span>
              <span className="h-0.5 flex-1 rounded bg-line" />
            </div>
          </>
        )}

        <form onSubmit={submitEmail} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {emailError && <p className="text-sm font-semibold text-danger">{emailError}</p>}
          </div>
          <Button type="submit" fullWidth loading={checking}>
            Continue
          </Button>
        </form>
        <p className="text-center text-xs text-muted">
          New here? Just enter your email — we&apos;ll set you up.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={back}
        className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {step.email}
      </button>

      {step.name === "password" ? (
        <form action={loginAction} className="space-y-4">
          <input type="hidden" name="email" value={step.email} />
          {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
            />
            {loginState.fieldErrors?.password && (
              <p className="text-sm font-semibold text-danger">{loginState.fieldErrors.password}</p>
            )}
          </div>
          {loginState.error && (
            <p className="text-sm font-semibold text-danger">{loginState.error}</p>
          )}
          <Button type="submit" fullWidth loading={loggingIn}>
            Log in
          </Button>
        </form>
      ) : (
        <form action={signupAction} className="space-y-4">
          <input type="hidden" name="email" value={step.email} />
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" name="name" autoComplete="name" autoFocus required />
            {signupState.fieldErrors?.name && (
              <p className="text-sm font-semibold text-danger">{signupState.fieldErrors.name}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Choose a password</Label>
            <Input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {hint ? (
              <p className={`text-xs font-semibold ${hint.tone}`}>{hint.label}</p>
            ) : (
              <p className="text-xs text-muted">At least 8 characters.</p>
            )}
            {signupState.fieldErrors?.password && (
              <p className="text-sm font-semibold text-danger">{signupState.fieldErrors.password}</p>
            )}
          </div>
          {signupState.error && (
            <p className="text-sm font-semibold text-danger">{signupState.error}</p>
          )}
          {signupState.fieldErrors?.email && (
            <p className="text-sm font-semibold text-danger">{signupState.fieldErrors.email}</p>
          )}
          <Button type="submit" fullWidth loading={signingUp}>
            Create account
          </Button>
        </form>
      )}
    </div>
  );
}
