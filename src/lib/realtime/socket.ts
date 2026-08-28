"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";

/*
 * Singleton typed Socket.io client.
 *
 * The handshake token is fetched fresh from /api/realtime/token on every
 * (re)connection attempt — socket.io calls the auth function again on each
 * reconnect, so an expired 5-minute token never strands the client.
 */

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4000";

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(REALTIME_URL, {
      autoConnect: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: (cb) => {
        fetch("/api/realtime/token")
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
          .then((data: { token: string }) => cb({ token: data.token }))
          .catch(() => cb({ token: "" })); // server rejects; surfaces connect_error
      },
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
