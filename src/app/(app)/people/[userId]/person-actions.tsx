"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { blockUser } from "@/server/actions/people";
import { startCall } from "@/server/actions/call";
import { usePresence } from "@/lib/realtime/use-presence";
import { Button } from "@/components/ui/button";

/*
 * Call and Block. Calling is disabled while the person is offline — ringing
 * someone who cannot hear it just wastes 45 seconds — and the reason is
 * shown as text, not only as a tooltip.
 */

export function PersonActions({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const { online, ready } = usePresence();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isOnline = online.has(userId);
  const callDisabled = pending || !isOnline;
  const reason = !ready
    ? "Checking if they are online…"
    : isOnline
      ? null
      : `${name} is offline right now. They will see you called when they are back.`;

  function call() {
    setError(null);
    startTransition(async () => {
      const result = await startCall(userId).catch(() => ({
        ok: false as const,
        error: "Could not start the call. Try again.",
      }));
      if (result.ok) router.push(`/practice/call/${result.roomId}`);
      else setError(result.error);
    });
  }

  function confirmBlock() {
    setError(null);
    startTransition(async () => {
      const result = await blockUser(userId).catch(() => ({
        ok: false as const,
        error: "Could not block. Try again.",
      }));
      if (result.ok) router.push("/people");
      else setError(result.error);
    });
  }

  return (
    <section className="space-y-3">
      <div>
        <Button
          className="h-12 w-full text-base"
          onClick={call}
          disabled={callDisabled}
          title={reason ?? `Call ${name}`}
        >
          {pending ? "Calling…" : `📞 Call ${name}`}
        </Button>
        {reason && <p className="pt-1 text-center text-xs text-muted-foreground">{reason}</p>}
      </div>

      {confirming ? (
        <div className="space-y-3 rounded-xl border border-destructive/50 p-4">
          <p className="text-sm">
            Block {name}? You will not see each other in the directory again, and neither of you
            can call the other.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="destructive" className="h-11" onClick={confirmBlock} disabled={pending}>
              {pending ? "Blocking…" : "Yes, block"}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="h-11 w-full" onClick={() => setConfirming(true)}>
          Block {name}
        </Button>
      )}

      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </section>
  );
}
