"use client";

import { usePresence } from "@/lib/realtime/use-presence";
import { lastSeenLabel } from "@/lib/relative-time";

/**
 * Live online indicator. The dot is decoration: the state is always
 * spelled out in words too, so colour never carries the meaning alone.
 */
export function PresenceDot({ userId, lastSeenAt }: { userId: string; lastSeenAt: string | null }) {
  const { online } = usePresence();

  if (online.has(userId)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-success">
        <span className="size-2.5 rounded-full bg-success" aria-hidden />
        Online now
      </span>
    );
  }
  return (
    <span className="text-sm font-semibold text-muted">
      {lastSeenLabel(lastSeenAt ? new Date(lastSeenAt) : null)}
    </span>
  );
}
