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
export type CallErrorCode = "peer-absent" | "busy";

/** A person in a group room, as the lobby and room screen show them. */
export type RoomMember = {
  userId: string;
  name: string;
  level: CefrLevel | null;
  avatarUpdatedAt: string | null;
  isHost: boolean;
};

/** A live room as the lobby lists it. */
export type LobbyRoomSummary = {
  id: string;
  title: string;
  topic: string;
  level: CefrLevel;
  hostId: string;
  maxSize: number;
  members: RoomMember[];
  /** Closed rooms arrive with live=false so the lobby can drop them. */
  live: boolean;
};

/** client -> server */
export interface ClientToServerEvents {
  /** Ask for the current online set and receive updates. */
  "presence:subscribe": () => void;
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
  /**
   * Leaving a call that never connected: the Leave button, browser back, or
   * the tab closing. Explicit on purpose — inferring it from the disconnect
   * handler is what used to end matches during ordinary navigation.
   */
  "call:abandon": (payload: { roomId: string }) => void;

  /** Live lobby: the current room list, then a message per change. */
  "lobby:subscribe": () => void;
  /** Group rooms (part 1: membership only, no audio yet). */
  "group:join": (payload: { roomId: string }) => void;
  "group:leave": (payload: { roomId: string }) => void;
}

/** server -> client */
export interface ServerToClientEvents {
  /** The full online set, sent once on subscribe. */
  "presence:list": (payload: { userIds: string[] }) => void;
  /** One user came online or went offline. */
  "presence:changed": (payload: { userId: string; online: boolean }) => void;
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
  /**
   * Delivered to the CALLEE's user:<id> room, not the call room — the point
   * of ringing is to reach someone who is browsing elsewhere and has not
   * joined the room yet.
   */
  "call:ring": (payload: {
    roomId: string;
    fromUserId: string;
    fromName: string;
    fromLevel: CefrLevel;
    /** ISO timestamp of the caller's avatar, or null — for the overlay image. */
    avatarUpdatedAt: string | null;
    topic: MatchedTopic;
  }) => void;
  /** To the CALLER's user room, so it lands wherever they navigated. */
  "call:declined": (payload: { roomId: string }) => void;
  "call:missed": (payload: { roomId: string }) => void;
  "lobby:rooms": (payload: { rooms: LobbyRoomSummary[] }) => void;
  "lobby:changed": (payload: { room: LobbyRoomSummary }) => void;
  "group:joined": (payload: { roomId: string; members: RoomMember[] }) => void;
  "group:member-joined": (payload: { roomId: string; member: RoomMember }) => void;
  "group:member-left": (payload: { roomId: string; userId: string }) => void;
  error: (payload: { code: ErrorCode; message: string }) => void;
}
