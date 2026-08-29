"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSocket } from "@/lib/realtime/socket";
import type { MatchedTopic, PartnerProfile } from "@/lib/realtime/events";
import { LevelBadge } from "@/components/level-badge";
import { Button } from "@/components/ui/button";
import type { CefrLevel } from "@/generated/prisma/enums";

/*
 * Find-a-partner flow: idle → waiting (timer + position) → matched → call.
 * On a match the partner card is shown briefly, then the user is routed to
 * /practice/call/[roomId], which owns the WebRTC connection.
 */

type Phase =
  | { name: "idle" }
  | { name: "connecting" }
  | { name: "waiting"; position: number; estimatedWait: number }
  | { name: "matched"; partner: PartnerProfile; topic: MatchedTopic; roomId: string }
  | { name: "timeout" }
  | { name: "partner_left" }
  | { name: "error"; message: string };

export function FindPartner({ level }: { level: CefrLevel }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [waitSeconds, setWaitSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  // Wire socket listeners once; clean up socket + queue on unmount.
  useEffect(() => {
    const socket = getSocket();

    socket.on("queue:waiting", ({ position, estimatedWait }) => {
      setPhase((p) =>
        p.name === "waiting" || p.name === "connecting"
          ? { name: "waiting", position, estimatedWait }
          : p,
      );
    });
    socket.on("queue:matched", ({ partner, topic, roomId }) => {
      stopTimer();
      setPhase({ name: "matched", partner, topic, roomId });
      // Brief pause so the partner card registers before the call screen
      // takes over and asks for the microphone.
      setTimeout(() => router.push(`/practice/call/${roomId}`), 1500);
    });
    socket.on("queue:timeout", () => {
      stopTimer();
      setPhase({ name: "timeout" });
    });
    socket.on("room:partner_left", () => {
      stopTimer();
      setPhase({ name: "partner_left" });
    });
    socket.on("error", ({ message }) => {
      stopTimer();
      setPhase({ name: "error", message });
    });
    socket.on("connect_error", () => {
      stopTimer();
      setPhase({
        name: "error",
        message: "Couldn't reach the matching service. It may be down — try again in a minute.",
      });
    });

    return () => {
      stopTimer();
      socket.emit("queue:leave");
      socket.off("queue:waiting");
      socket.off("queue:matched");
      socket.off("queue:timeout");
      socket.off("room:partner_left");
      socket.off("error");
      socket.off("connect_error");
      socket.disconnect();
    };
  }, [router]);

  function findPartner() {
    const socket = getSocket();
    setPhase({ name: "connecting" });
    setWaitSeconds(0);
    stopTimer();
    timerRef.current = setInterval(() => setWaitSeconds((s) => s + 1), 1000);

    const join = () => socket.emit("queue:join", {});
    if (socket.connected) join();
    else {
      socket.once("connect", join);
      socket.connect();
    }
  }

  function cancel() {
    stopTimer();
    getSocket().emit("queue:leave");
    setPhase({ name: "idle" });
  }

  return (
    <main className="mx-auto max-w-md space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Talk with a person</h1>
        <LevelBadge level={level} />
      </div>

      {phase.name === "idle" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We&apos;ll pair you with another learner at your level (or one step away). Be kind, be
            patient, and keep it in English — see the{" "}
            <Link href="/guidelines" className="underline">
              community guidelines
            </Link>
            .
          </p>
          <Button className="h-12 w-full text-base" onClick={findPartner}>
            Find a partner
          </Button>
        </div>
      )}

      {(phase.name === "connecting" || phase.name === "waiting") && (
        <div className="space-y-4 rounded-2xl border p-6 text-center">
          <div className="mx-auto size-16 animate-spin rounded-full border-4 border-primary/20 border-t-primary" aria-hidden />
          <p className="font-medium">Looking for a partner…</p>
          <p className="text-sm tabular-nums text-muted-foreground">
            {Math.floor(waitSeconds / 60)}:{String(waitSeconds % 60).padStart(2, "0")}
            {phase.name === "waiting" && <> · position {phase.position} in queue</>}
          </p>
          <Button variant="outline" className="h-11" onClick={cancel}>
            Cancel
          </Button>
        </div>
      )}

      {phase.name === "matched" && (
        <div className="space-y-4 rounded-2xl border p-6 text-center">
          <p className="text-sm font-medium text-green-600 dark:text-green-400">Partner found!</p>
          <div className="mx-auto flex size-20 items-center justify-center overflow-hidden rounded-full bg-accent text-3xl font-bold">
            {phase.partner.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={phase.partner.photoUrl} alt="" className="size-full object-cover" />
            ) : (
              phase.partner.name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="text-lg font-bold">{phase.partner.name}</p>
            <LevelBadge level={phase.partner.level} />
          </div>
          {phase.topic && (
            <p className="rounded-lg bg-accent p-3 text-sm">
              Suggested topic: {phase.topic.icon} <span className="font-medium">{phase.topic.title}</span>
            </p>
          )}
          <p className="text-sm text-muted-foreground">Starting your call…</p>
        </div>
      )}

      {phase.name === "timeout" && (
        <div className="space-y-4 rounded-2xl border p-6 text-center">
          <span className="text-3xl" aria-hidden>⏳</span>
          <p className="font-medium">No partner right now</p>
          <p className="text-sm text-muted-foreground">
            Nobody at your level is waiting at the moment. Your AI partner is always up for a chat.
          </p>
          <div className="grid gap-2">
            <Link
              href="/practice/ai"
              className="flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Practice with AI instead
            </Link>
            <Button variant="outline" className="h-11" onClick={findPartner}>
              Try again
            </Button>
          </div>
        </div>
      )}

      {phase.name === "partner_left" && (
        <div className="space-y-4 rounded-2xl border p-6 text-center">
          <span className="text-3xl" aria-hidden>👋</span>
          <p className="font-medium">Your partner left</p>
          <Button className="h-11 w-full" onClick={findPartner}>
            Find another partner
          </Button>
        </div>
      )}

      {phase.name === "error" && (
        <div className="space-y-4 rounded-2xl border border-destructive/50 p-6 text-center">
          <p className="text-sm text-destructive">{phase.message}</p>
          <Button variant="outline" className="h-11" onClick={findPartner}>
            Try again
          </Button>
        </div>
      )}
    </main>
  );
}
