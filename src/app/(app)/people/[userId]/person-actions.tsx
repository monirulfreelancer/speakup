"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { blockUser } from "@/server/actions/people";
import { Button } from "@/components/ui/button";

/*
 * Call is present but inert until direct calling ships, so the layout does
 * not shift when it turns on. Block works now and is confirmed first —
 * it is not reversible from this screen.
 */

export function PersonActions({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
      <div className="group relative">
        <Button className="h-12 w-full text-base" disabled>
          📞 Call {name}
        </Button>
        {/* Tooltip: title carries it for touch/assistive users too. */}
        <span
          title="Coming next"
          className="pointer-events-none absolute inset-x-0 -top-9 mx-auto hidden w-max rounded-lg bg-foreground px-3 py-1 text-xs text-background group-hover:block"
        >
          Coming next
        </span>
        <p className="pt-1 text-center text-xs text-muted-foreground">Coming next</p>
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
