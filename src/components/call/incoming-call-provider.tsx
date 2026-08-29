"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/realtime/socket";
import { Ringtone } from "@/lib/rtc/ringtone";
import { Avatar } from "@/components/avatar";
import { Phone, PhoneOff } from "lucide-react";

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
    // Full screen on mobile so the call is unmissable; a centred card from
    // sm up. Accept and Decline are pushed to opposite edges with a wide gap
    // — a mis-tap here hangs up on a real person.
    <div className="fixed inset-0 z-[100] flex flex-col justify-between bg-background p-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:items-center sm:justify-center sm:bg-scrim">
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center sm:w-full sm:max-w-sm sm:flex-none sm:rounded-3xl sm:border-2 sm:border-line sm:bg-surface sm:p-8">
        <span className="relative flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-primary animate-ring-pulse" aria-hidden />
          <Avatar
            user={{
              id: ringing.fromUserId,
              displayName: ringing.fromName,
              avatarUpdatedAt: ringing.avatarUpdatedAt,
            }}
            size={128}
            className="relative"
            priority
          />
        </span>

        <div className="space-y-1">
          <p className="text-sm font-bold uppercase tracking-wide text-muted">Incoming call</p>
          <p className="text-3xl font-extrabold">{ringing.fromName}</p>
          <p className="text-sm font-extrabold text-muted">Level {ringing.fromLevel}</p>
        </div>

        {ringing.topic && (
          <p className="rounded-2xl bg-surface-raised px-4 py-3 text-sm font-semibold">
            {ringing.topic.icon} <span className="font-extrabold">{ringing.topic.title}</span>
          </p>
        )}
      </div>

      <div className="flex items-end justify-between gap-10 sm:absolute sm:bottom-16 sm:justify-center">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={decline}
            aria-label="Decline call"
            className="btn-3d flex size-18 items-center justify-center rounded-full bg-danger text-white [--btn-edge:var(--danger-dark)] active:btn-3d-press"
          >
            <PhoneOff className="size-7" aria-hidden />
          </button>
          <span className="text-sm font-bold text-muted">Decline</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={accept}
            aria-label="Accept call"
            className="btn-3d flex size-18 items-center justify-center rounded-full bg-primary text-on-primary [--btn-edge:var(--primary-dark)] active:btn-3d-press"
          >
            <Phone className="size-7" aria-hidden />
          </button>
          <span className="text-sm font-bold text-muted">Accept</span>
        </div>
      </div>
    </div>
  );
}
