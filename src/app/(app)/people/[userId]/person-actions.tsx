"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Phone, PhoneCall } from "lucide-react";
import { blockUser } from "@/server/actions/people";
import { endMyCall, startCall } from "@/server/actions/call";
import { usePresence } from "@/lib/realtime/use-presence";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

/*
 * Call is the clear primary action; Block is deliberately quiet — it is
 * rare, permanent, and should never be the thing a thumb finds first.
 * Calling is disabled while the person is offline, with the reason as
 * visible text rather than only a tooltip.
 */

export function PersonActions({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const { online, ready } = usePresence();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set only when the caller genuinely has a live call: an informational
  // state with a way out, not a red dead end.
  const [busy, setBusy] = useState<{ message: string; roomId: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const isOnline = online.has(userId);
  const reason = !ready
    ? "Checking if they are online…"
    : isOnline
      ? null
      : `${name} is offline right now. They will see you called when they are back.`;

  function call() {
    setError(null);
    setBusy(null);
    startTransition(async () => {
      const result = await startCall(userId).catch(() => ({
        ok: false as const,
        error: "Could not start the call. Try again.",
      }));
      if (result.ok) {
        router.push(`/practice/call/${result.roomId}`);
      } else if ("busyRoomId" in result) {
        setBusy({ message: result.error, roomId: result.busyRoomId });
      } else {
        setError(result.error);
      }
    });
  }

  function endExistingCall() {
    startTransition(async () => {
      await endMyCall().catch(() => null);
      setBusy(null);
      // Straight into the call they actually wanted.
      call();
    });
  }

  function confirmBlock() {
    setError(null);
    startTransition(async () => {
      const result = await blockUser(userId).catch(() => ({
        ok: false as const,
        error: "Could not block. Try again.",
      }));
      if (result.ok) router.push("/dashboard");
      else setError(result.error);
    });
  }

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <Button
          size="lg"
          fullWidth
          loading={pending && !confirming}
          onClick={call}
          disabled={!isOnline}
          title={reason ?? `Call ${name}`}
        >
          <Phone className="size-5" aria-hidden />
          Call {name}
        </Button>
        {reason && <p className="text-center text-xs font-semibold text-muted">{reason}</p>}
      </div>

      {busy && (
        <div className="space-y-3 rounded-2xl border-2 border-line bg-surface-raised p-4 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-bold">
            <PhoneCall className="size-4 text-primary" aria-hidden />
            {busy.message}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href={`/practice/call/${busy.roomId}`}
              className="flex min-h-11 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-bold text-on-primary"
            >
              Return to your call
            </Link>
            <Button variant="secondary" onClick={endExistingCall} loading={pending}>
              End that call
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-center text-sm font-semibold text-danger">{error}</p>}

      <div className="text-center">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="min-h-11 px-4 text-sm font-bold text-muted underline underline-offset-4 hover:text-danger"
        >
          Block {name}
        </button>
      </div>

      <Sheet open={confirming} onClose={() => setConfirming(false)} title={`Block ${name}?`}>
        <p className="text-sm text-muted">
          You will not see each other in the directory again, and neither of you can call the
          other. This cannot be undone from here.
        </p>
        <div className="grid grid-cols-2 gap-2 pt-4">
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={pending} onClick={confirmBlock}>
            Block
          </Button>
        </div>
      </Sheet>
    </section>
  );
}
