"use client";

import { usePresence } from "@/lib/realtime/use-presence";
import { lastSeenLabel } from "@/lib/relative-time";

/** Live online indicator; falls back to the relative last-seen text. */
export function PresenceDot({
  userId,
  lastSeenAt,
}: {
  userId: string;
  lastSeenAt: string | null;
}) {
  const { online } = usePresence();

  if (online.has(userId)) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
        <span className="size-2 rounded-full bg-green-500" aria-hidden />
        Online now
      </span>
    );
  }
  return (
    <span className="text-sm text-muted-foreground">
      {lastSeenLabel(lastSeenAt ? new Date(lastSeenAt) : null)}
    </span>
  );
}
