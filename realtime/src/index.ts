import express from "express";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { verifySocketToken, type SocketUser } from "./auth";
import { dbHealthy } from "./db";
import type { CefrLevel, ClientToServerEvents, ServerToClientEvents } from "./events";
import { adjacentLevels, dequeue, endMatchByRoom, enqueue, queuePosition, runMatcher } from "./matching";

/*
 * SpeakUp realtime service.
 *
 * Standalone Node process (own Dockerfile, own Coolify service). It never
 * imports from the Next.js app; the socket event contract in ./events.ts is
 * mirrored there by hand.
 */

const PORT = Number(process.env.PORT ?? 4000);
const MATCH_TIMEOUT_SECONDS = Number(process.env.MATCH_TIMEOUT_SECONDS ?? 90);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:3000";
// Rough per-position wait estimate shown in the UI, in seconds.
const WAIT_PER_POSITION = 15;

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  data: { user: SocketUser; roomId?: string };
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

async function matchTick(): Promise<void> {
  try {
    const { matches, expired } = await runMatcher();

    for (const entry of expired) {
      emitToUser(entry.userId, (s) => s.emit("queue:timeout"));
    }

    for (const match of matches) {
      const aProfile = profileOf(match.a.userId);
      const bProfile = profileOf(match.b.userId);
      // Join every live socket of both users to the room, then notify.
      for (const [userId, partnerProfile] of [
        [match.a.userId, bProfile],
        [match.b.userId, aProfile],
      ] as const) {
        emitToUser(userId, (socket) => {
          void socket.join(match.roomId);
          socket.data.roomId = match.roomId;
          socket.emit("queue:matched", {
            roomId: match.roomId,
            partner: partnerProfile ?? { name: "Partner", photoUrl: null, level: "B1" },
            topic: match.topic,
          });
        });
      }
    }
  } catch (error) {
    console.error("matcher tick failed:", error instanceof Error ? error.message : error);
  }
}

function profileOf(userId: string) {
  const sockets = socketsByUser.get(userId);
  const user = sockets?.values().next().value?.data.user;
  return user ? { name: user.name, photoUrl: user.photoUrl, level: user.level } : null;
}

io.on("connection", (rawSocket) => {
  const socket = rawSocket as AppSocket;
  const user = socket.data.user;

  let set = socketsByUser.get(user.id);
  if (!set) socketsByUser.set(user.id, (set = new Set()));
  set.add(socket);

  socket.on("queue:join", async (payload) => {
    if (!user.isAdult) {
      socket.emit("error", { code: "not-adult", message: "Partner practice is 18+ for now." });
      return;
    }
    try {
      const requested = Array.isArray(payload?.allowedLevels)
        ? payload.allowedLevels.filter((l): l is CefrLevel => LEVELS.includes(l))
        : [];
      // Only same-or-adjacent levels are ever allowed; the payload can narrow
      // that set but not widen it.
      const adjacency = adjacentLevels(user.level);
      const allowed = requested.length > 0 ? adjacency.filter((l) => requested.includes(l)) : adjacency;

      const { position } = await enqueue(user.id, user.level, allowed, MATCH_TIMEOUT_SECONDS);
      socket.emit("queue:waiting", { position, estimatedWait: position * WAIT_PER_POSITION });
      await matchTick();
    } catch (error) {
      console.error("queue:join failed:", error instanceof Error ? error.message : error);
      socket.emit("error", { code: "server-error", message: "Couldn't join the queue. Try again." });
    }
  });

  socket.on("queue:leave", async () => {
    await dequeue(user.id).catch(() => {});
  });

  socket.on("room:ready", () => {
    // Presence ack — becomes meaningful when the call arrives (Phase 13).
  });

  socket.on("room:leave", async ({ roomId }) => {
    if (socket.data.roomId !== roomId) return;
    socket.data.roomId = undefined;
    socket.to(roomId).emit("room:partner_left");
    void socket.leave(roomId);
    await endMatchByRoom(roomId, "left").catch(() => {});
  });

  socket.on("disconnect", async () => {
    set!.delete(socket);
    if (set!.size === 0) socketsByUser.delete(user.id);

    // Last live socket gone: leave the queue; tell any matched partner.
    if (!socketsByUser.has(user.id)) {
      await dequeue(user.id).catch(() => {});
      if (socket.data.roomId) {
        socket.to(socket.data.roomId).emit("room:partner_left");
        await endMatchByRoom(socket.data.roomId, "disconnected").catch(() => {});
      }
    }
  });
});

// Periodic matcher: picks up waiters when someone new arrives on another
// instance/tab, and drives timeouts.
setInterval(() => void matchTick(), 3000);

// Waiting-position refresh so the UI counter stays honest.
setInterval(async () => {
  for (const [userId, sockets] of socketsByUser) {
    try {
      const position = await queuePosition(userId);
      if (position !== null) {
        for (const s of sockets) {
          s.emit("queue:waiting", { position, estimatedWait: position * WAIT_PER_POSITION });
        }
      }
    } catch {
      // transient — next tick will retry
    }
  }
}, 5000);

httpServer.listen(PORT, () => {
  console.log(`speakup-realtime listening on :${PORT}`);
});
