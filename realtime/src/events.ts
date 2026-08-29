/*
 * Socket event contract for the realtime service.
 *
 * MIRRORED at src/lib/realtime/events.ts in the web app — the two copies
 * must stay byte-identical (a shared package isn't worth a monorepo yet).
 * Change one, change both.
 */

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type PartnerProfile = {
  name: string;
  photoUrl: string | null;
  level: CefrLevel;
};

export type MatchedTopic = {
  title: string;
  icon: string;
} | null;

export type ErrorCode =
  | "unauthenticated"
  | "not-adult"
  | "already-queued"
  | "bad-request"
  | "server-error";

/**
 * WebRTC signaling payloads. The server relays these verbatim to the other
 * room member and never inspects, stores or logs their contents.
 */
export type SdpPayload = { roomId: string; sdp: RTCSessionDescriptionLike };
export type IcePayload = { roomId: string; candidate: RTCIceCandidateLike };

/** Structural mirrors of the browser types, so realtime/ needs no DOM lib. */
export type RTCSessionDescriptionLike = { type: string; sdp?: string };
export type RTCIceCandidateLike = {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
};

export type CallEndReason = "hangup" | "failed" | "partner_left";

/** client -> server */
export interface ClientToServerEvents {
  "queue:join": (payload: { allowedLevels?: CefrLevel[] }) => void;
  "queue:leave": () => void;
  "room:ready": (payload: { roomId: string }) => void;
  "room:leave": (payload: { roomId: string }) => void;
  "rtc:offer": (payload: SdpPayload) => void;
  "rtc:answer": (payload: SdpPayload) => void;
  "rtc:ice": (payload: IcePayload) => void;
  "call:end": (payload: { roomId: string; reason: CallEndReason }) => void;
}

/** server -> client */
export interface ServerToClientEvents {
  "queue:waiting": (payload: { position: number; estimatedWait: number }) => void;
  "queue:matched": (payload: {
    roomId: string;
    partner: PartnerProfile;
    topic: MatchedTopic;
  }) => void;
  "queue:timeout": () => void;
  "room:partner_left": () => void;
  "rtc:offer": (payload: SdpPayload) => void;
  "rtc:answer": (payload: SdpPayload) => void;
  "rtc:ice": (payload: IcePayload) => void;
  "call:ended": (payload: { reason: CallEndReason }) => void;
  error: (payload: { code: ErrorCode; message: string }) => void;
}
