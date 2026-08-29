"use client";

import { useTransition } from "react";
import { signInWithGoogle } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";

/** Google's mark, inline so no external asset is fetched. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.4z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.8-6.1C1 16.7 0 20.2 0 24s1 7.3 2.6 10.4l7.8-5.7z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.7-3.7-13.6-9.1l-7.8 5.7C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function GoogleButton({ callbackUrl }: { callbackUrl?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      fullWidth
      size="lg"
      loading={pending}
      onClick={() => start(async () => void (await signInWithGoogle(callbackUrl)))}
    >
      {!pending && <GoogleMark />}
      Continue with Google
    </Button>
  );
}
