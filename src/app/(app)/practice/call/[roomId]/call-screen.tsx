"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/realtime/socket";
import type { IcePayload, SdpPayload } from "@/lib/realtime/events";
import { isPolitePeer, VoiceCall, type CallStats, type ConnectionState } from "@/lib/rtc/peer";
import { Ringtone } from "@/lib/rtc/ringtone";
import { LevelBadge } from "@/components/level-badge";
import { Button } from "@/components/ui/button";
import { AudioMeter } from "@/components/speech/audio-meter";
import { PostCall } from "./post-call";
import type { CefrLevel } from "@/generated/prisma/enums";

/*
 * Phone-style call flow.
 *
 * idle -> outgoing/incoming -> connecting -> connected -> ended
 *
 * WHY THE HANDSHAKE EXISTS: the previous version opened a peer connection
 * the moment the screen mounted and sent an offer immediately. If the other
 * peer's socket had not joined the room yet, the offer was relayed to
 * nobody and BOTH sides waited on "Connecting…" forever. Now nothing
 * touches the microphone or RTCPeerConnection until an invite has been
 * accepted, which proves the callee is present and listening before any SDP
 * moves. The server also answers call:error when the peer is absent, so
 * that case surfaces as a message rather than a spinner.
 */

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

type Phase = "idle" | "outgoing" | "incoming" | "connecting" | "connected" | "ended";

type EndedReason =
  | "you-ended"
  | "partner-ended"
  | "declined"
  | "no-answer"
  | "failed"
  | "peer-absent"
  | "mic-denied";

const ENDED_COPY: Record<EndedReason, string> = {
  "you-ended": "You ended the call.",
  "partner-ended": "Your partner ended the call.",
  declined: "Your partner declined the call.",
  "no-answer": "No answer. Your partner may have stepped away.",
  failed:
    "The call could not connect. This usually means one of you is on a network that blocks voice calls. Try mobile data or another network.",
  "peer-absent": "Your partner is no longer here.",
  "mic-denied":
    "SpeakUp could not use your microphone. Allow access in your browser, then call again.",
};

const INVITE_TIMEOUT_MS = 45_000;

/*
 * Socket tracing for call debugging. Event names and roomIds only — never
 * SDP bodies or ICE candidate strings.
 */
const RTC_DEBUG = process.env.NEXT_PUBLIC_RTC_DEBUG === "1";
function sigLog(direction: "->" | "<-", event: string, roomId?: string): void {
  if (RTC_DEBUG) console.log(`[signal ${direction}]`, event, roomId ? `room=${roomId}` : "");
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function qualityLabel(stats: CallStats | null): { label: string; tone: string } {
  if (!stats) return { label: "Measuring", tone: "text-muted-foreground" };
  const total = stats.packetsReceived + stats.packetsLost;
  const lossPct = total > 0 ? (stats.packetsLost / total) * 100 : 0;
  if (lossPct > 5 || (stats.roundTripMs ?? 0) > 400) {
    return { label: "Poor connection", tone: "text-red-600 dark:text-red-400" };
  }
  if (lossPct > 2 || stats.candidatePairType === "relay") {
    return { label: "Fair connection", tone: "text-amber-600 dark:text-amber-400" };
  }
  return { label: "Good connection", tone: "text-green-600 dark:text-green-400" };
}

export function CallScreen(props: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [endedReason, setEndedReason] = useState<EndedReason>("you-ended");
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  // Room state: nothing may be sent before the server confirms the join, and
  // Call stays disabled until the partner is actually connected.
  const [joined, setJoined] = useState(false);
  const [peerPresent, setPeerPresent] = useState(false);

  const callRef = useRef<VoiceCall | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ringtoneRef = useRef<Ringtone | null>(null);
  const inviteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedPathRef = useRef(false);
  // Mirrors `phase` for the socket handlers, which are registered once and
  // would otherwise close over a stale value.
  const phaseRef = useRef<Phase>("idle");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // The caller in a glare tie is the lexicographically smaller user id —
  // the same rule as politeness, so both sides agree with no extra round trip.
  const winsGlare = props.selfUserId < props.partnerUserId;

  const clearInviteTimer = useCallback(() => {
    if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current);
    inviteTimerRef.current = null;
  }, []);

  const stopRinging = useCallback(() => {
    ringtoneRef.current?.stop();
    if (typeof document !== "undefined") {
      document.title = document.title.replace(/^• /, "");
    }
  }, []);

  const teardown = useCallback(() => {
    clearInviteTimer();
    stopRinging();
    callRef.current?.stop();
    callRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }, [clearInviteTimer, stopRinging]);

  const finish = useCallback(
    (reason: EndedReason) => {
      teardown();
      setEndedReason(reason);
      setPhase("ended");
    },
    [teardown],
  );

  /** Builds the peer connection. Called only after the handshake completes. */
  const beginMedia = useCallback(
    (initiator: boolean) => {
      const socket = getSocket();
      const call = new VoiceCall(
        props.roomId,
        isPolitePeer(props.selfUserId, props.partnerUserId),
        initiator,
        {
          onLocalStream: setLocalStream,
          onRemoteStream: (stream) => {
            setRemoteStream(stream);
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = stream;
              void remoteAudioRef.current.play().catch(() => {});
            }
          },
          onState: (state) => {
            setConnectionState(state);
            if (state === "connected") setPhase("connected");
          },
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
          onError: (code) => {
            if (code === "failed") finish("failed");
            else finish("mic-denied");
          },
        },
      );
      callRef.current = call;
      setPhase("connecting");
      void call.start();
    },
    [finish, props.partnerUserId, props.roomId, props.selfUserId],
  );

  // Socket wiring: registered once, reads current phase through phaseRef.
  useEffect(() => {
    const socket = getSocket();
    ringtoneRef.current = new Ringtone();

    const onInvite = () => {
      sigLog("<-", "call:invite", props.roomId);
      // Glare: both pressed Call. The smaller user id stays the caller; the
      // other side flips to incoming and accepts immediately, so the call
      // still connects instead of deadlocking on two waiting screens.
      if (phaseRef.current === "outgoing") {
        if (winsGlare) return; // keep our invite; theirs is ignored
        clearInviteTimer();
        socket.emit("call:accept", { roomId: props.roomId });
        beginMedia(false);
        return;
      }
      if (phaseRef.current !== "idle") return;
      setPhase("incoming");
      ringtoneRef.current?.start();
      document.title = `• ${document.title.replace(/^• /, "")}`;
    };

    const onAccept = () => {
      sigLog("<-", "call:accept", props.roomId);
      if (phaseRef.current !== "outgoing") return;
      clearInviteTimer();
      beginMedia(true);
    };

    const onDecline = () => {
      sigLog("<-", "call:decline", props.roomId);
      if (phaseRef.current !== "outgoing") return;
      finish("declined");
    };

    const onCancel = () => {
      sigLog("<-", "call:cancel", props.roomId);
      if (phaseRef.current !== "incoming") return;
      stopRinging();
      setPhase("idle");
    };

    const onCallError = ({ code }: { code: string }) => {
      sigLog("<-", `call:error(${code})`, props.roomId);
      if (code !== "peer-absent") return;
      if (phaseRef.current === "outgoing" || phaseRef.current === "connecting") {
        finish("peer-absent");
      }
    };

    const onEnded = () => {
      if (phaseRef.current === "ended" || phaseRef.current === "idle") return;
      finish("partner-ended");
    };

    const onOffer = (payload: SdpPayload) => void callRef.current?.handleDescription(payload.sdp);
    const onAnswer = (payload: SdpPayload) => void callRef.current?.handleDescription(payload.sdp);
    const onIce = (payload: IcePayload) => void callRef.current?.handleCandidate(payload.candidate);

    socket.on("call:invite", onInvite);
    socket.on("call:accept", onAccept);
    socket.on("call:decline", onDecline);
    socket.on("call:cancel", onCancel);
    socket.on("call:error", onCallError);
    socket.on("call:ended", onEnded);
    socket.on("room:partner_left", onEnded);
    socket.on("rtc:offer", onOffer);
    socket.on("rtc:answer", onAnswer);
    socket.on("rtc:ice", onIce);

    const onJoined = ({ peerPresent: present }: { peerPresent: boolean }) => {
      sigLog("<-", "room:joined", props.roomId);
      setJoined(true);
      setPeerPresent(present);
    };

    const onPeer = ({ present }: { present: boolean }) => {
      sigLog("<-", `room:peer(${present ? "present" : "absent"})`, props.roomId);
      setPeerPresent(present);
      if (present) return;
      // The partner vanished. Ringing or connected states must react now
      // rather than waiting for a timeout.
      if (phaseRef.current === "outgoing") finish("peer-absent");
      else if (phaseRef.current === "incoming") {
        stopRinging();
        setPhase("idle");
      } else if (phaseRef.current === "connecting" || phaseRef.current === "connected") {
        finish("partner-ended");
      }
    };

    socket.on("room:joined", onJoined);
    socket.on("room:peer", onPeer);

    /*
     * Join on mount AND on every reconnect. Membership used to depend on
     * room:ready during matching, so a reload or a dropped socket left this
     * peer outside the room and every invite was silently discarded.
     */
    const joinRoom = () => {
      sigLog("->", "room:join", props.roomId);
      socket.emit("room:join", { roomId: props.roomId });
    };
    const onConnect = () => {
      if (RTC_DEBUG) console.log("[socket] connected id=", socket.id);
      setJoined(false);
      joinRoom();
    };
    const onDisconnect = (reason: string) => {
      if (RTC_DEBUG) console.log("[socket] disconnected:", reason);
      setJoined(false);
      setPeerPresent(false);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (socket.connected) joinRoom();
    else socket.connect();

    return () => {
      socket.off("room:joined", onJoined);
      socket.off("room:peer", onPeer);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("call:invite", onInvite);
      socket.off("call:accept", onAccept);
      socket.off("call:decline", onDecline);
      socket.off("call:cancel", onCancel);
      socket.off("call:error", onCallError);
      socket.off("call:ended", onEnded);
      socket.off("room:partner_left", onEnded);
      socket.off("rtc:offer", onOffer);
      socket.off("rtc:answer", onAnswer);
      socket.off("rtc:ice", onIce);
      ringtoneRef.current?.stop();
      ringtoneRef.current = null;
    };
  }, [beginMedia, clearInviteTimer, finish, props.roomId, stopRinging, winsGlare]);

  // Teardown on unmount (navigating away mid-call).
  useEffect(() => teardown, [teardown]);

  // Call timer runs only while connected.
  useEffect(() => {
    if (phase !== "connected") return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  function callPartner() {
    const socket = getSocket();
    setPhase("outgoing");
    sigLog("->", "call:invite", props.roomId);
    socket.emit("call:invite", { roomId: props.roomId });
    clearInviteTimer();
    inviteTimerRef.current = setTimeout(() => {
      socket.emit("call:cancel", { roomId: props.roomId });
      finish("no-answer");
    }, INVITE_TIMEOUT_MS);
  }

  function cancelOutgoing() {
    clearInviteTimer();
    sigLog("->", "call:cancel", props.roomId);
    getSocket().emit("call:cancel", { roomId: props.roomId });
    setPhase("idle");
  }

  function acceptIncoming() {
    stopRinging();
    sigLog("->", "call:accept", props.roomId);
    getSocket().emit("call:accept", { roomId: props.roomId });
    beginMedia(false);
  }

  function declineIncoming() {
    stopRinging();
    sigLog("->", "call:decline", props.roomId);
    getSocket().emit("call:decline", { roomId: props.roomId });
    setPhase("idle");
  }

  function hangUp() {
    sigLog("->", "call:end", props.roomId);
    getSocket().emit("call:end", { roomId: props.roomId, reason: "hangup" });
    finish("you-ended");
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    callRef.current?.setMuted(next);
  }

  if (phase === "ended") {
    return (
      <PostCall
        matchId={props.matchId}
        partnerName={props.partnerName}
        note={ENDED_COPY[endedReason]}
        onDone={() => router.push("/dashboard")}
      />
    );
  }

  const quality = qualityLabel(stats);

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-md flex-col justify-between p-4 md:min-h-dvh md:p-8">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <section className="space-y-4 pt-8 text-center">
        <div
          className={`mx-auto flex size-24 items-center justify-center overflow-hidden rounded-full bg-accent text-4xl font-bold ${
            phase === "incoming" ? "animate-pulse" : ""
          }`}
        >
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

        <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
          {phase === "idle" &&
            (peerPresent
              ? "Ready when you are"
              : joined
                ? "Waiting for your partner to arrive…"
                : "Connecting to the room…")}
          {phase === "outgoing" && `Calling ${props.partnerName}…`}
          {phase === "incoming" && "Incoming call"}
          {phase === "connecting" &&
            (connectionState === "reconnecting" ? "Reconnecting…" : "Connecting…")}
          {phase === "connected" && formatClock(elapsed)}
        </p>
        {phase === "connected" && <p className={`text-xs ${quality.tone}`}>{quality.label}</p>}

        {props.topic && phase !== "incoming" && (
          <p className="rounded-xl bg-accent p-3 text-sm">
            Talk about {props.topic.icon} <span className="font-medium">{props.topic.title}</span>
          </p>
        )}
      </section>

      <section className="space-y-6 pb-6">
        {phase === "connected" && (
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
        )}

        {phase === "idle" && (
          <div className="grid gap-2">
            <Button
              className="h-14 w-full rounded-full text-base font-medium"
              onClick={callPartner}
              disabled={!joined || !peerPresent}
            >
              📞 Call {props.partnerName}
            </Button>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => router.push("/practice/human")}
            >
              Leave
            </Button>
          </div>
        )}

        {phase === "outgoing" && (
          <div className="flex justify-center">
            <Button variant="destructive" className="h-14 rounded-full px-8" onClick={cancelOutgoing}>
              Cancel
            </Button>
          </div>
        )}

        {phase === "incoming" && (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="destructive" className="h-14 rounded-full" onClick={declineIncoming}>
              Decline
            </Button>
            <Button className="h-14 rounded-full bg-green-600 text-white hover:bg-green-700" onClick={acceptIncoming}>
              Accept
            </Button>
          </div>
        )}

        {(phase === "connecting" || phase === "connected") && (
          <div className="flex justify-center gap-3">
            <Button
              variant={muted ? "default" : "outline"}
              className="size-14 rounded-full text-xl"
              onClick={toggleMute}
              aria-pressed={muted}
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              disabled={phase !== "connected"}
            >
              {muted ? "🔇" : "🎙️"}
            </Button>
            <Button variant="destructive" className="h-14 rounded-full px-8 font-medium" onClick={hangUp}>
              End call
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
