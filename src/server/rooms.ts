import "server-only";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBlockedIds } from "@/server/people";
import type { CefrLevel } from "@/generated/prisma/enums";

/*
 * Lobby and room reads.
 *
 * A room is LIVE when it is not closed and still has at least one
 * participant who has not left — a room whose last person walked out is
 * not something to show in a lobby, even in the moment before the sweep
 * closes it.
 */

export type LobbyRoom = {
  id: string;
  title: string;
  topic: string;
  level: CefrLevel;
  hostId: string;
  maxSize: number;
  participants: {
    id: string;
    name: string;
    avatarUpdatedAt: Date | null;
  }[];
};

export async function getLobbyRooms(): Promise<LobbyRoom[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  // Never show a room hosted by someone in a block relationship either way.
  const hidden = await getBlockedIds(session.user.id);

  const rooms = await db.room.findMany({
    where: {
      closedAt: null,
      hostId: { notIn: hidden },
      participants: { some: { leftAt: null } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      title: true,
      topic: true,
      level: true,
      hostId: true,
      maxSize: true,
      participants: {
        where: { leftAt: null },
        select: { userId: true },
      },
    },
  });
  if (rooms.length === 0) return [];

  const userIds = [...new Set(rooms.flatMap((r) => r.participants.map((p) => p.userId)))];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, avatarUpdatedAt: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  return rooms.map((room) => ({
    id: room.id,
    title: room.title,
    topic: room.topic,
    level: room.level,
    hostId: room.hostId,
    maxSize: room.maxSize,
    participants: room.participants
      .map((p) => byId.get(p.userId))
      .filter((u): u is NonNullable<typeof u> => Boolean(u)),
  }));
}

/** The room screen's data, or null when the viewer is not a live member. */
export async function getRoomForMember(roomId: string, userId: string) {
  const room = await db.room.findFirst({
    where: { id: roomId, closedAt: null },
    select: {
      id: true,
      title: true,
      topic: true,
      level: true,
      hostId: true,
      maxSize: true,
      participants: { where: { leftAt: null }, select: { userId: true, joinedAt: true } },
    },
  });
  if (!room) return null;
  if (!room.participants.some((p) => p.userId === userId)) return null;

  const users = await db.user.findMany({
    where: { id: { in: room.participants.map((p) => p.userId) } },
    select: { id: true, name: true, cefrLevel: true, avatarUpdatedAt: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  return {
    ...room,
    members: room.participants
      .map((p) => {
        const user = byId.get(p.userId);
        return user ? { ...user, isHost: user.id === room.hostId } : null;
      })
      .filter((m): m is NonNullable<typeof m> => Boolean(m)),
  };
}
