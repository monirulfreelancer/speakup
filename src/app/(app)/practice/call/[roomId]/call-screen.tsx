"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/realtime/socket";
import type { IcePayload, SdpPayload } from "@/lib/realtime/events";
import {
  isPolitePeer,
  VoiceCall,
  type CallStats,
  type ConnectionState,
} from "@/lib/rtc/peer";
import { LevelBadge } from "@/components/level-badge";
import { Button } from "@/components/ui/button";
import { AudioMeter } from "@/components/speech/audio-meter";
import { PostCall } from "./post-call";
import type { CefrLevel } from "@/generated/prisma/enums";

type Props = {
  roomId: string;
  matchId: string;
  selfUserId: string;
  partnerUserId: string;
  partnerName: string;
  partnerPhotoUrl: string | null;
  partnerLevel: CefrLevel | null;
  topic: { title: string; icon: string } | null;
};

type ErrorState = { title: string; detail: string } | null;

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function qualityLabel(stats: CallStats | null): { label: string; tone: string } {
  if (!stats) return { label: "Measuring", tone: "text-muted-foreground" };
  const total = stats.packetsReceived + stats.packetsLost;
  const lossPct = total > 0 ? (stats.packetsLost / total) * 100 : 0;
  const relayed = stats.candidatePairType === "relay";

  if (lossPct > 5 || (stats.roundTripMs ?? 0) > 400) {
    return { label: "Poor connection", tone: "text-red-600 dark:text-red-400" };
  }
  if (lossPct > 2 || relayed) {
    return { label: "Fair connection", tone: "text-amber-600 dark:text-amber-400" };
  }
  return { label: "Good connection", tone: "text-green-600 dark:text-green-400" };
}

export function CallScreen(props: Props) {
  const router = useRouter();
  const [state, setState] = useState<ConnectionState>("connecting");
  const [error, setError] = useState<ErrorState>(null);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [finished, setFinished] = useState(false);

  const callRef = useRef<VoiceCall | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  // Reported once, when the connection settles, so the Match row records
  // whether TURN was needed.
  const reportedPathRef = useRef(false);

  const endCall = useCallback(
    (reason: "hangup" | "failed" | "partner_left") => {
      const socket = getSocket();
      if (socket.connected) socket.emit("call:end", { roomId: props.roomId, reason });
      callRef.current?.stop();
      callRef.current = null;
      setFinished(true);
    },
    [props.roomId],
  );

  useEffect(() => {
    const socket = getSocket();
    const polite = isPolitePeer(props.selfUserId, props.partnerUserId);

    const call = new VoiceCall(props.roomId, polite, {
      onLocalStream: setLocalStream,
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          void remoteAudioRef.current.play().catch(() => {
            // Autoplay can be blocked until the user interacts; the mute
            // button counts, and the call still connects.
          });
        }
      },
      onState: setState,
      onStats: (next) => {
        setStats(next);
        if (!reportedPathRef.current && next.candidatePairType !== "unknown") {
          reportedPathRef.current = true;
          void fetch("/api/rtc/path", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId: props.roomId, type: next.candidatePairType }),
          }).catch(() => {});
        }
      },
      onSignal: (kind, payload) => {
        if (kind === "offer") socket.emit("rtc:offer", payload as SdpPayload);
        else if (kind === "answer") socket.emit("rtc:answer", payload as SdpPayload);
        else socket.emit("rtc:ice", payload as IcePayload);
      },
      onError: (code, message) => {
        setError({
          title:
            code === "no-permission"
              ? "Microphone blocked"
              : code === "no-mic"
                ? "No microphone found"
                : "Could not connect",
          detail: message,
        });
      },
    });
    callRef.current = call;

    const onOffer = (payload: SdpPayload) => void call.handleDescription(payload.sdp);
    const onAnswer = (payload: SdpPayload) => void call.handleDescription(payload.sdp);
    const onIce = (payload: IcePayload) => void call.handleCandidate(payload.candidate);
    const onEnded = () => {
      setError({
        title: "Your partner left",
        detail: "The call ended because your partner hung up or lost connection.",
      });
      call.stop();
      setFinished(true);
    };
    const onPartnerLeft = onEnded;

    socket.on("rtc:offer", onOffer);
    socket.on("rtc:answer", onAnswer);
    socket.on("rtc:ice", onIce);
    socket.on("call:ended", onEnded);
    socket.on("room:partner_left", onPartnerLeft);

    const begin = () => {
      socket.emit("room:ready", { roomId: props.roomId });
      void call.start();
    };
    if (socket.connected) begin();
    else {
      socket.once("connect", begin);
      socket.connect();
    }

    return () => {
      socket.off("rtc:offer", onOffer);
      socket.off("rtc:answer", onAnswer);
      socket.off("rtc:ice", onIce);
      socket.off("call:ended", onEnded);
      socket.off("room:partner_left", onPartnerLeft);
      call.stop();
    };
  }, [props.roomId, props.selfUserId, props.partnerUserId]);

  // Call timer, running only while connected.
  useEffect(() => {
    if (state !== "connected") return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    callRef.current?.setMuted(next);
  }

  if (finished) {
    return (
      <PostCall
        matchId={props.matchId}
        partnerName={props.partnerName}
        note={error?.detail ?? null}
        onDone={() => router.push("/dashboard")}
      />
    );
  }

  const quality = qualityLabel(stats);

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-md flex-col justify-between p-4 md:min-h-dvh md:p-8">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <section className="space-y-4 pt-6 text-center">
        <div className="mx-auto flex size-24 items-center justify-center overflow-hidden rounded-full bg-accent text-4xl font-bold">
          {props.partnerPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.partnerPhotoUrl} alt="" className="size-full object-cover" />
          ) : (
            props.partnerName.charAt(0).toUpperCase()
          )}
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold">{props.partnerName}</h1>
          {props.partnerLevel && <LevelBadge level={props.partnerLevel} />}
        </div>

        <p className="text-sm tabular-nums text-muted-foreground">
          {state === "connected"
            ? formatClock(elapsed)
            : state === "connecting"
              ? "Connecting…"
              : state === "reconnecting"
                ? "Reconnecting…"
                : state === "failed"
                  ? "Connection failed"
                  : "Call ended"}
        </p>
        {state === "connected" && <p className={`text-xs ${quality.tone}`}>{quality.label}</p>}

        {props.topic && (
          <p className="rounded-xl bg-accent p-3 text-sm">
            Talk about {props.topic.icon}{" "}
            <span className="font-medium">{props.topic.title}</span>
          </p>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/50 p-4 text-left">
            <p className="font-medium text-destructive">{error.title}</p>
            <p className="text-sm text-muted-foreground">{error.detail}</p>
          </div>
        )}
      </section>

      <section className="space-y-6 pb-6">
        <div className="flex items-end justify-center gap-8">
          <div className="space-y-1 text-center">
            <AudioMeter stream={muted ? null : localStream} />
            <p className="text-xs text-muted-foreground">You</p>
          </div>
          <div className="space-y-1 text-center">
            <AudioMeter stream={remoteStream} />
            <p className="text-xs text-muted-foreground">{props.partnerName}</p>
          </div>
        </div>

        <div className="flex justify-center gap-3">
          <Button
            variant={muted ? "default" : "outline"}
            className="h-14 w-14 rounded-full text-xl"
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? "Unmute microphone" : "Mute microphone"}
          >
            {muted ? "🔇" : "🎙️"}
          </Button>
          <Button
            variant="destructive"
            className="h-14 rounded-full px-8 font-medium"
            onClick={() => endCall("hangup")}
          >
            End call
          </Button>
        </div>
      </section>
    </main>
  );
}
