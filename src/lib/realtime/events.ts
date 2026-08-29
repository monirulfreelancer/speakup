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

/** Why a call:error came back: today only the peer being absent. */
export type CallErrorCode = "peer-absent";

/** client -> server */
export interface ClientToServerEvents {
  "queue:join": (payload: { allowedLevels?: CefrLevel[] }) => void;
  "queue:leave": () => void;
  "room:ready": (payload: { roomId: string }) => void;
  "room:leave": (payload: { roomId: string }) => void;
  /**
   * Explicit, idempotent room membership. The ONLY reliable way into the
   * socket.io room: room:ready fires during matching only, so a direct
   * visit, a reload or a socket reconnect would otherwise leave the peer
   * outside the room and every invite would be dropped.
   */
  "room:join": (payload: { roomId: string }) => void;
  "rtc:offer": (payload: SdpPayload) => void;
  "rtc:answer": (payload: SdpPayload) => void;
  "rtc:ice": (payload: IcePayload) => void;
  "call:end": (payload: { roomId: string; reason: CallEndReason }) => void;
  // Ring-before-connect handshake. Nothing touches the microphone or opens a
  // peer connection until an invite has been accepted, which also guarantees
  // both sockets are in the room before any SDP is sent.
  "call:invite": (payload: { roomId: string }) => void;
  "call:accept": (payload: { roomId: string }) => void;
  "call:decline": (payload: { roomId: string }) => void;
  "call:cancel": (payload: { roomId: string }) => void;
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
  /** Confirms the join, and says whether the other member is here right now. */
  "room:joined": (payload: { roomId: string; peerPresent: boolean }) => void;
  /** Sent to the other member whenever this room's presence changes. */
  "room:peer": (payload: { roomId: string; present: boolean }) => void;
  "rtc:offer": (payload: SdpPayload) => void;
  "rtc:answer": (payload: SdpPayload) => void;
  "rtc:ice": (payload: IcePayload) => void;
  "call:ended": (payload: { reason: CallEndReason }) => void;
  "call:invite": (payload: { roomId: string }) => void;
  "call:accept": (payload: { roomId: string }) => void;
  "call:decline": (payload: { roomId: string }) => void;
  "call:cancel": (payload: { roomId: string }) => void;
  /** Sent back to the SENDER when the other member is not in the room. */
  "call:error": (payload: { roomId: string; code: CallErrorCode }) => void;
  error: (payload: { code: ErrorCode; message: string }) => void;
}
