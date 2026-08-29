"use client";

import type { IcePayload, RTCSessionDescriptionLike, SdpPayload } from "@/lib/realtime/events";

/*
 * Audio-only peer connection with perfect negotiation.
 *
 * Perfect negotiation (the pattern from the WebRTC spec) removes glare: if
 * both sides happen to offer at once, one of them must yield. The POLITE
 * peer rolls back its own offer and accepts the other's; the impolite peer
 * ignores the incoming one. Politeness is decided by comparing user ids, so
 * both sides independently reach the same answer with no extra signaling.
 *
 * Video is never requested anywhere — no camera permission prompt exists in
 * this app.
 */

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "failed" | "ended";
export type CandidatePairType = "host" | "srflx" | "prflx" | "relay" | "unknown";

export type CallStats = {
  candidatePairType: CandidatePairType;
  packetsLost: number;
  packetsReceived: number;
  roundTripMs: number | null;
};

export type PeerCallbacks = {
  onLocalStream: (stream: MediaStream) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onState: (state: ConnectionState) => void;
  onStats: (stats: CallStats) => void;
  onSignal: (
    kind: "offer" | "answer" | "ice",
    payload: SdpPayload | IcePayload,
  ) => void;
  onError: (code: "no-mic" | "no-permission" | "failed", message: string) => void;
};

type IceServerConfig = { iceServers: RTCIceServer[] };

export async function fetchIceServers(): Promise<IceServerConfig> {
  try {
    const response = await fetch("/api/rtc/credentials");
    if (!response.ok) throw new Error(String(response.status));
    const data = (await response.json()) as IceServerConfig;
    return { iceServers: data.iceServers ?? [] };
  } catch {
    // Never block the call on a credentials hiccup: public STUN alone still
    // connects on most networks.
    return { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  }
}

export class VoiceCall {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream = new MediaStream();
  private makingOffer = false;
  private ignoreOffer = false;
  private isSettingRemoteAnswerPending = false;
  private iceRestarted = false;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private ended = false;

  constructor(
    private readonly roomId: string,
    private readonly polite: boolean,
    private readonly callbacks: PeerCallbacks,
  ) {}

  /** Acquires the mic and opens the connection. The impolite peer offers first. */
  async start(): Promise<void> {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        this.callbacks.onError(
          "no-permission",
          "SpeakUp needs your microphone for the call. Allow access in your browser, then rejoin.",
        );
      } else {
        this.callbacks.onError(
          "no-mic",
          "No microphone was found. Plug one in or check your device settings, then rejoin.",
        );
      }
      return;
    }

    this.localStream = stream;
    this.callbacks.onLocalStream(stream);
    this.callbacks.onState("connecting");

    const config = await fetchIceServers();
    const pc = new RTCPeerConnection(config);
    this.pc = pc;

    for (const track of stream.getTracks()) pc.addTrack(track, stream);

    pc.ontrack = ({ track }) => {
      this.remoteStream.addTrack(track);
      this.callbacks.onRemoteStream(this.remoteStream);
    };

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      this.callbacks.onSignal("ice", {
        roomId: this.roomId,
        candidate: candidate.toJSON() as IcePayload["candidate"],
      });
    };

    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) {
          this.callbacks.onSignal("offer", {
            roomId: this.roomId,
            sdp: pc.localDescription.toJSON() as RTCSessionDescriptionLike,
          });
        }
      } catch {
        // A failed offer surfaces through the ICE state machine below.
      } finally {
        this.makingOffer = false;
      }
    };

    pc.onconnectionstatechange = () => {
      if (this.ended) return;
      if (pc.connectionState === "connected") {
        this.callbacks.onState("connected");
        this.startStatsPolling();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (this.ended) return;
      const state = pc.iceConnectionState;
      if (state === "disconnected") {
        this.callbacks.onState("reconnecting");
      } else if (state === "failed") {
        // Exactly ONE ICE restart, then give up. Retrying forever hides a
        // genuinely unreachable peer behind a spinner.
        if (!this.iceRestarted) {
          this.iceRestarted = true;
          this.callbacks.onState("reconnecting");
          pc.restartIce();
        } else {
          this.callbacks.onState("failed");
          this.callbacks.onError(
            "failed",
            "The call could not connect. This usually means one of you is on a network that blocks voice calls. Try mobile data or another network.",
          );
        }
      }
    };

    // The impolite peer kicks off negotiation, so both sides do not offer
    // simultaneously on a healthy connection.
    if (!this.polite) {
      void pc.setLocalDescription().then(() => {
        if (pc.localDescription) {
          this.callbacks.onSignal("offer", {
            roomId: this.roomId,
            sdp: pc.localDescription.toJSON() as RTCSessionDescriptionLike,
          });
        }
      });
    }
  }

  /** Handles an incoming offer or answer (perfect-negotiation rules). */
  async handleDescription(description: RTCSessionDescriptionLike): Promise<void> {
    const pc = this.pc;
    if (!pc) return;

    const readyForOffer =
      !this.makingOffer && (pc.signalingState === "stable" || this.isSettingRemoteAnswerPending);
    const offerCollision = description.type === "offer" && !readyForOffer;

    this.ignoreOffer = !this.polite && offerCollision;
    if (this.ignoreOffer) return;

    try {
      this.isSettingRemoteAnswerPending = description.type === "answer";
      await pc.setRemoteDescription(description as RTCSessionDescriptionInit);
      this.isSettingRemoteAnswerPending = false;

      if (description.type === "offer") {
        await pc.setLocalDescription();
        if (pc.localDescription) {
          this.callbacks.onSignal("answer", {
            roomId: this.roomId,
            sdp: pc.localDescription.toJSON() as RTCSessionDescriptionLike,
          });
        }
      }
    } catch {
      this.isSettingRemoteAnswerPending = false;
    }
  }

  async handleCandidate(candidate: IcePayload["candidate"]): Promise<void> {
    const pc = this.pc;
    if (!pc) return;
    try {
      await pc.addIceCandidate(candidate as RTCIceCandidateInit);
    } catch {
      // Candidates that arrive during rollback are expected to fail; the
      // ignoreOffer flag marks the ones we deliberately dropped.
      if (!this.ignoreOffer) {
        // Nothing actionable — ICE has other candidates to try.
      }
    }
  }

  setMuted(muted: boolean): void {
    for (const track of this.localStream?.getAudioTracks() ?? []) {
      track.enabled = !muted;
    }
  }

  /*
   * Reports which ICE path won (host = direct LAN, srflx = through NAT via
   * STUN, relay = through TURN) plus loss and RTT. The relay rate is the
   * number that decides whether coturn keeps living on this VPS.
   */
  private startStatsPolling(): void {
    if (this.statsTimer) return;
    this.statsTimer = setInterval(async () => {
      const pc = this.pc;
      if (!pc) return;
      try {
        const report = await pc.getStats();
        let candidatePairType: CandidatePairType = "unknown";
        let roundTripMs: number | null = null;
        let packetsLost = 0;
        let packetsReceived = 0;

        const candidates = new Map<string, { candidateType?: string }>();
        report.forEach((entry) => {
          if (entry.type === "local-candidate" || entry.type === "remote-candidate") {
            candidates.set(entry.id, entry as { candidateType?: string });
          }
        });

        report.forEach((entry) => {
          if (entry.type === "candidate-pair" && entry.state === "succeeded" && entry.nominated) {
            const local = candidates.get(entry.localCandidateId);
            const remote = candidates.get(entry.remoteCandidateId);
            // A relay on either end means the media is going through TURN.
            const type =
              local?.candidateType === "relay" || remote?.candidateType === "relay"
                ? "relay"
                : (local?.candidateType ?? "unknown");
            candidatePairType = type as CandidatePairType;
            if (typeof entry.currentRoundTripTime === "number") {
              roundTripMs = Math.round(entry.currentRoundTripTime * 1000);
            }
          }
          if (entry.type === "inbound-rtp" && entry.kind === "audio") {
            packetsLost = entry.packetsLost ?? 0;
            packetsReceived = entry.packetsReceived ?? 0;
          }
        });

        this.callbacks.onStats({ candidatePairType, packetsLost, packetsReceived, roundTripMs });
      } catch {
        // Stats are diagnostics; never let them break a working call.
      }
    }, 3000);
  }

  /** Stops every track, closes the connection, drops all listeners. */
  stop(): void {
    if (this.ended) return;
    this.ended = true;

    if (this.statsTimer) clearInterval(this.statsTimer);
    this.statsTimer = null;

    for (const track of this.localStream?.getTracks() ?? []) track.stop();
    this.localStream = null;

    for (const track of this.remoteStream.getTracks()) {
      this.remoteStream.removeTrack(track);
    }

    const pc = this.pc;
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onnegotiationneeded = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
    }
    this.pc = null;
    this.callbacks.onState("ended");
  }
}

/** Both peers derive the same answer without extra signaling. */
export function isPolitePeer(selfUserId: string, partnerUserId: string): boolean {
  return selfUserId < partnerUserId;
}
