"use client";

import { useEffect, useState } from "react";
import { getSocket } from "./socket";

/*
 * Subscribes to the online set and keeps it live. Used by the directory and
 * profile pages so green dots update without a reload.
 *
 * Returns a Set of online user ids; empty until the first presence:list
 * arrives, so callers should treat "not in the set" as offline-or-unknown
 * and fall back to the lastSeenAt text.
 */

export function usePresence(): { online: Set<string>; ready: boolean } {
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const onList = ({ userIds }: { userIds: string[] }) => {
      setOnline(new Set(userIds));
      setReady(true);
    };
    const onChanged = ({ userId, online: isOnline }: { userId: string; online: boolean }) => {
      setOnline((prev) => {
        const next = new Set(prev);
        if (isOnline) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    socket.on("presence:list", onList);
    socket.on("presence:changed", onChanged);

    // Re-subscribe on every connect, so a reconnect refreshes the set.
    const subscribe = () => socket.emit("presence:subscribe");
    socket.on("connect", subscribe);
    if (socket.connected) subscribe();
    else socket.connect();

    return () => {
      socket.off("presence:list", onList);
      socket.off("presence:changed", onChanged);
      socket.off("connect", subscribe);
    };
  }, []);

  return { online, ready };
}
