import express from "express";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { verifySocketToken, type SocketUser } from "./auth";
import { dbHealthy } from "./db";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";
import {
  checkRoomMembership,
  endMatchByRoom,
  forgetRoomMembership,
  loadOpenMatch,
  loadRingProfile,
  openMatchElsewhere,
  touchLastSeen,
} from "./matching";
import type { CefrLevel } from "./events";

/*
 * SpeakUp realtime service.
 *
 * Standalone Node process (own Dockerfile, own Coolify service). It never
 * imports from the Next.js app; the socket event contract in ./events.ts is
 * mirrored there by hand.
 */

const PORT = Number(process.env.PORT ?? 4000);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:3000";

/** Socket.io room that every presence subscriber joins. */
const PRESENCE_ROOM = "presence:subscribers";

/** Unanswered ring gives up here; the Match closes as no_answer. */
const RING_TIMEOUT_MS = 45_000;

/** roomId -> pending no-answer timer, so accept/decline can cancel it. */
const ringTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearRingTimer(roomId: string): void {
  const timer = ringTimers.get(roomId);
  if (timer) clearTimeout(timer);
  ringTimers.delete(roomId);
}

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  data: { user: SocketUser; roomId?: string; callActive?: boolean };
};

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: ALLOWED_ORIGIN },
});

app.get("/health", async (_req, res) => {
  const db = await dbHealthy();
  res.status(200).json({ status: "ok", db });
});

// userId -> live sockets (a user can have several tabs).
const socketsByUser = new Map<string, Set<AppSocket>>();

function emitToUser(userId: string, emit: (socket: AppSocket) => void): void {
  for (const socket of socketsByUser.get(userId) ?? []) emit(socket);
}

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (typeof token !== "string") return next(new Error("unauthenticated"));
  const user = await verifySocketToken(token);
  if (!user) return next(new Error("unauthenticated"));
  (socket as AppSocket).data.user = user;
  next();
});

io.on("connection", (rawSocket) => {
  const socket = rawSocket as AppSocket;
  const user = socket.data.user;

  /*
   * Presence is REFERENCE COUNTED, not a boolean: a user with three tabs
   * open is online once, and closing one tab must not mark them offline.
   * socketsByUser is that count — the set of live sockets per user.
   */
  let set = socketsByUser.get(user.id);
  const wasOnline = Boolean(set && set.size > 0);
  if (!set) socketsByUser.set(user.id, (set = new Set()));
  set.add(socket);

  // Per-user room, so part 2 can ring a specific person directly.
  void socket.join(`user:${user.id}`);

  if (!wasOnline) {
    io.to(PRESENCE_ROOM).emit("presence:changed", { userId: user.id, online: true });
  }

  socket.on("presence:subscribe", () => {
    void socket.join(PRESENCE_ROOM);
    socket.emit("presence:list", { userIds: [...socketsByUser.keys()] });
  });

  /*
   * Explicit room membership.
   *
   * This is the fix for invites vanishing: sockets used to enter the room
   * only through room:ready during matching, so a direct visit, a page
   * reload or a socket reconnect left the peer outside the room and the
   * server's presence check found nobody. The call screen now emits
   * room:join on mount AND on every reconnect, and waits for room:joined
   * before it will let anyone press Call.
   *
   * Idempotent: socket.join on a room already joined is a no-op.
   */
  socket.on("room:join", async ({ roomId }) => {
    if (!(await guardRoom(roomId, "room:join"))) return;

    void socket.join(roomId);
    socket.data.roomId = roomId;

    const sockets = await io.in(roomId).fetchSockets();
    const peers = sockets.filter((s) => s.id !== socket.id);
    console.log(
      `[signal] room:join room=${roomId} user=${user.id} roomSize=${sockets.length} peerPresent=${peers.length > 0}`,
    );

    socket.emit("room:joined", { roomId, peerPresent: peers.length > 0 });
    // Tell whoever was already here that their partner just arrived.
    socket.to(roomId).emit("room:peer", { roomId, present: true });
  });

  socket.on("room:ready", async ({ roomId }) => {
    // Presence ack: the peer reached the call screen. Join it to the room so
    // signaling can reach it even if this socket reconnected since matching.
    if (!(await guardRoom(roomId, "room:ready"))) return;
    void socket.join(roomId);
    socket.data.roomId = roomId;
  });

  /*
   * WebRTC signaling relay.
   *
   * The server is a dumb pipe: it verifies the sender really belongs to the
   * room (see isRoomMember — otherwise any logged-in user could guess a
   * roomId and inject SDP into a stranger's call), then forwards the payload
   * untouched to the OTHER member. SDP and ICE contents are never inspected,
   * stored, or logged; log lines carry the event name, roomId and userId only.
   */
  async function guardRoom(roomId: string, event: string): Promise<boolean> {
    if (typeof roomId !== "string" || roomId.length === 0) return false;
    try {
      const check = await checkRoomMembership(roomId, user.id);
      if (!check.ok) {
        // Log WHY, not just that it failed: whether the row exists at all,
        // its end state, and who the members actually are. Diagnosing this
        // from "(not a member)" alone cost a debugging round trip.
        console.warn(
          `[signal] rejected ${event} room=${roomId} user=${user.id}` +
            ` matchFound=${check.found}` +
            (check.found
              ? ` endReason=${check.endReason ?? "null"} endedAt=${check.endedAt ? "set" : "null"}` +
                ` members=[${check.members?.join(", ")}]`
              : ""),
        );
        socket.emit("error", { code: "bad-request", message: "That call is not available." });
      }
      return check.ok;
    } catch (error) {
      console.error(`[signal] membership check failed for ${event} room=${roomId}:`, error instanceof Error ? error.message : error);
      return false;
    }
  }

  /*
   * Is anyone else actually in this room right now?
   *
   * Silently relaying into an empty room is what made calls hang forever:
   * the offer went nowhere and both sides waited. Every call-control event
   * now checks first and tells the SENDER when the peer is absent, so the
   * UI can say so instead of spinning.
   */
  async function peerPresent(roomId: string): Promise<boolean> {
    const sockets = await io.in(roomId).fetchSockets();
    return sockets.some((s) => s.id !== socket.id);
  }

  socket.on("call:invite", async ({ roomId }) => {
    if (!(await guardRoom(roomId, "call:invite"))) return;
    void socket.join(roomId);
    socket.data.roomId = roomId;

    const match = await loadOpenMatch(roomId);
    if (!match) {
      socket.emit("call:error", { roomId, code: "peer-absent" });
      return;
    }
    const targetId = match.userAId === user.id ? match.userBId : match.userAId;

    const targetSockets = await io.in(`user:${targetId}`).fetchSockets();
    if (targetSockets.length === 0) {
      console.log(`[signal] call:invite room=${roomId} user=${user.id} -> target offline`);
      socket.emit("call:error", { roomId, code: "peer-absent" });
      await endMatchByRoom(roomId, "cancelled").catch(() => {});
      return;
    }

    if (await openMatchElsewhere(targetId, roomId)) {
      console.log(`[signal] call:invite room=${roomId} user=${user.id} -> target busy`);
      socket.emit("call:error", { roomId, code: "busy" });
      await endMatchByRoom(roomId, "cancelled").catch(() => {});
      return;
    }

    const profile = await loadRingProfile(user.id);
    console.log(`[signal] call:ring room=${roomId} from=${user.id} to=${targetId}`);
    io.to(`user:${targetId}`).emit("call:ring", {
      roomId,
      fromUserId: user.id,
      fromName: profile?.name ?? "A learner",
      fromLevel: (profile?.level ?? "B1") as CefrLevel,
      avatarUpdatedAt: profile?.avatarUpdatedAt ?? null,
      topic:
        match.topicTitle && match.topicIcon
          ? { title: match.topicTitle, icon: match.topicIcon }
          : null,
    });

    // Server-owned no-answer timeout: both sides hear about it even if one
    // of them navigated away mid-ring.
    clearRingTimer(roomId);
    ringTimers.set(
      roomId,
      setTimeout(() => {
        void (async () => {
          ringTimers.delete(roomId);
          console.log(`[signal] call:missed room=${roomId} from=${user.id} to=${targetId}`);
          io.to(`user:${user.id}`).emit("call:missed", { roomId });
          io.to(`user:${targetId}`).emit("call:missed", { roomId });
          await endMatchByRoom(roomId, "no_answer").catch(() => {});
          forgetRoomMembership(roomId);
        })();
      }, RING_TIMEOUT_MS),
    );
  });

  socket.on("call:accept", async ({ roomId }) => {
    if (!(await guardRoom(roomId, "call:accept"))) return;
    clearRingTimer(roomId);
    void socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.callActive = true;

    const match = await loadOpenMatch(roomId);
    const callerId = match ? (match.userAId === user.id ? match.userBId : match.userAId) : null;
    console.log(`[signal] call:accept room=${roomId} user=${user.id}`);
    // To the caller's user room AND the call room: the caller may be sitting
    // on the call screen (in the room) or still navigating to it.
    // User room ONLY: it reaches the caller wherever they are, including on
    // the call screen. Also emitting to the call room delivered it twice,
    // which would build two peer connections.
    if (callerId) io.to(`user:${callerId}`).emit("call:accept", { roomId });
  });

  socket.on("call:decline", async ({ roomId }) => {
    if (!(await guardRoom(roomId, "call:decline"))) return;
    clearRingTimer(roomId);

    const match = await loadOpenMatch(roomId);
    const callerId = match ? (match.userAId === user.id ? match.userBId : match.userAId) : null;
    console.log(`[signal] call:decline room=${roomId} user=${user.id}`);
    if (callerId) io.to(`user:${callerId}`).emit("call:declined", { roomId });

    await endMatchByRoom(roomId, "declined").catch(() => {});
    forgetRoomMembership(roomId);
  });

  socket.on("call:cancel", async ({ roomId }) => {
    if (!(await guardRoom(roomId, "call:cancel"))) return;
    clearRingTimer(roomId);

    const match = await loadOpenMatch(roomId);
    const targetId = match ? (match.userAId === user.id ? match.userBId : match.userAId) : null;
    console.log(`[signal] call:cancel room=${roomId} user=${user.id}`);
    // call:missed closes the callee's ringing overlay.
    if (targetId) io.to(`user:${targetId}`).emit("call:missed", { roomId });

    await endMatchByRoom(roomId, "cancelled").catch(() => {});
    forgetRoomMembership(roomId);
  });

  socket.on("rtc:offer", async (payload) => {
    if (!(await guardRoom(payload?.roomId, "rtc:offer"))) return;
    if (!(await peerPresent(payload.roomId))) {
      console.log(`[signal] rtc:offer room=${payload.roomId} user=${user.id} -> peer absent`);
      socket.emit("call:error", { roomId: payload.roomId, code: "peer-absent" });
      return;
    }
    socket.data.callActive = true;
    console.log(`[signal] rtc:offer room=${payload.roomId} user=${user.id}`);
    socket.to(payload.roomId).emit("rtc:offer", payload);
  });

  socket.on("rtc:answer", async (payload) => {
    if (!(await guardRoom(payload?.roomId, "rtc:answer"))) return;
    console.log(`[signal] rtc:answer room=${payload.roomId} user=${user.id}`);
    socket.to(payload.roomId).emit("rtc:answer", payload);
  });

  socket.on("rtc:ice", async (payload) => {
    if (!(await guardRoom(payload?.roomId, "rtc:ice"))) return;
    // Deliberately not logged per-candidate: high volume, and the contents
    // are network identifiers.
    socket.to(payload.roomId).emit("rtc:ice", payload);
  });

  socket.on("call:end", async ({ roomId, reason }) => {
    if (!(await guardRoom(roomId, "call:end"))) return;
    socket.data.callActive = false;
    clearRingTimer(roomId);
    console.log(`[signal] call:end room=${roomId} user=${user.id} reason=${reason}`);
    socket.to(roomId).emit("call:ended", { reason: reason === "failed" ? "failed" : "partner_left" });
    void socket.leave(roomId);
    socket.data.roomId = undefined;
    await endMatchByRoom(roomId, reason).catch(() => {});
    forgetRoomMembership(roomId);
  });

  socket.on("room:leave", async ({ roomId }) => {
    if (socket.data.roomId !== roomId) return;
    socket.data.roomId = undefined;
    socket.to(roomId).emit("room:partner_left");
    void socket.leave(roomId);
    await endMatchByRoom(roomId, "left").catch(() => {});
  });

  // `disconnecting` fires while socket.rooms is still populated; by
  // `disconnect` it has been cleared, so presence must be announced here.
  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;
      console.log(`[signal] room:peer(absent) room=${roomId} user=${user.id}`);
      socket.to(roomId).emit("room:peer", { roomId, present: false });
    }
  });

  socket.on("disconnect", async () => {
    set!.delete(socket);
    if (set!.size === 0) socketsByUser.delete(user.id);

    // Last live socket gone: mark offline, stamp lastSeenAt, tell any partner.
    if (!socketsByUser.has(user.id)) {
      io.to(PRESENCE_ROOM).emit("presence:changed", { userId: user.id, online: false });
      await touchLastSeen(user.id).catch(() => {});

      if (socket.data.roomId) {
        const roomId = socket.data.roomId;
        socket.to(roomId).emit("room:partner_left");
        socket.to(roomId).emit("call:ended", { reason: "partner_left" });

        /*
         * ONLY close the Match if a call was actually in progress.
         *
         * Navigating from the find-partner screen to the call screen
         * disconnects the singleton socket, and closing the Match there
         * stamped end_reason='disconnected' seconds after matching — which
         * then made BOTH members fail the membership check and never see
         * each other's invite. A disconnect with no live call is just
         * navigation; the match stays open so the call screen can join it.
         */
        if (socket.data.callActive) {
          await endMatchByRoom(roomId, "disconnected").catch(() => {});
          forgetRoomMembership(roomId);
        } else {
          console.log(
            `[signal] socket left room=${roomId} user=${user.id} without an active call — match left open`,
          );
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`speakup-realtime listening on :${PORT}`);
});
