"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/realtime/socket";
import { Ringtone } from "@/lib/rtc/ringtone";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";

/*
 * Global incoming-call overlay.
 *
 * Mounted in the app shell, so a ring reaches the user anywhere in the app
 * rather than only on a call screen. The server sends call:ring to this
 * user's own room, which every socket joins on connect.
 *
 * Exactly ONE call may ring at a time: a second ring while this one is up,
 * or while the user is already on a call screen, is declined immediately as
 * busy rather than stacking overlays.
 */

type Ringing = {
  roomId: string;
  fromUserId: string;
  fromName: string;
  fromLevel: string;
  avatarUpdatedAt: string | null;
  topic: { title: string; icon: string } | null;
};

export function IncomingCallProvider() {
  const router = useRouter();
  const [ringing, setRinging] = useState<Ringing | null>(null);
  const ringtoneRef = useRef<Ringtone | null>(null);
  const ringingRef = useRef<Ringing | null>(null);

  useEffect(() => {
    ringingRef.current = ringing;
  }, [ringing]);

  const stopRinging = useCallback(() => {
    ringtoneRef.current?.stop();
    if (typeof document !== "undefined") {
      document.title = document.title.replace(/^• /, "");
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();
    ringtoneRef.current = new Ringtone();

    const onRing = (payload: {
      roomId: string;
      fromUserId: string;
      fromName: string;
      fromLevel: string;
      avatarUpdatedAt?: string | null;
      topic: { title: string; icon: string } | null;
    }) => {
      // Already ringing, or already on a call screen: auto-decline as busy.
      const onCallScreen = window.location.pathname.startsWith("/practice/call/");
      if (ringingRef.current || onCallScreen) {
        socket.emit("call:decline", { roomId: payload.roomId });
        return;
      }
      setRinging({
        roomId: payload.roomId,
        fromUserId: payload.fromUserId,
        fromName: payload.fromName,
        fromLevel: payload.fromLevel,
        avatarUpdatedAt: payload.avatarUpdatedAt ?? null,
        topic: payload.topic,
      });
      ringtoneRef.current?.start();
      document.title = `• ${document.title.replace(/^• /, "")}`;
    };

    // The server gives up after its own timeout and tells both sides.
    const onMissed = ({ roomId }: { roomId: string }) => {
      if (ringingRef.current?.roomId !== roomId) return;
      stopRinging();
      setRinging(null);
    };

    socket.on("call:ring", onRing);
    socket.on("call:missed", onMissed);

    const subscribe = () => socket.emit("presence:subscribe");
    socket.on("connect", subscribe);
    if (socket.connected) subscribe();
    else socket.connect();

    return () => {
      socket.off("call:ring", onRing);
      socket.off("call:missed", onMissed);
      socket.off("connect", subscribe);
      ringtoneRef.current?.stop();
      ringtoneRef.current = null;
    };
  }, [stopRinging]);

  if (!ringing) return null;

  function accept() {
    const current = ringing;
    if (!current) return;
    stopRinging();
    getSocket().emit("call:accept", { roomId: current.roomId });
    setRinging(null);
    // The call screen sees the accepted match and connects straight away —
    // no second confirmation.
    router.push(`/practice/call/${current.roomId}`);
  }

  function decline() {
    const current = ringing;
    if (!current) return;
    stopRinging();
    getSocket().emit("call:decline", { roomId: current.roomId });
    setRinging(null);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border bg-background p-6 text-center shadow-xl">
        <Avatar
          user={{
            id: ringing.fromUserId,
            displayName: ringing.fromName,
            avatarUpdatedAt: ringing.avatarUpdatedAt,
          }}
          size={80}
          className="mx-auto animate-pulse"
          priority
        />
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Incoming call</p>
          <p className="text-xl font-bold">{ringing.fromName}</p>
          <p className="font-mono text-sm text-muted-foreground">{ringing.fromLevel}</p>
        </div>
        {ringing.topic && (
          <p className="rounded-xl bg-accent p-3 text-sm">
            {ringing.topic.icon} <span className="font-medium">{ringing.topic.title}</span>
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="destructive" className="h-14 rounded-full" onClick={decline}>
            Decline
          </Button>
          <Button
            className="h-14 rounded-full bg-green-600 text-white hover:bg-green-700"
            onClick={accept}
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
