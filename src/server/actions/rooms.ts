"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_ROOM_SIZE, MIN_ROOM_SIZE } from "@/lib/rooms";

/*
 * Group practice rooms: an open lobby anyone can start a room in, up to
 * five people per room.
 *
 * The capacity check is the load-bearing part. Counting participants and
 * then inserting is a classic race — two people tapping Join on the last
 * seat both count four and both insert. joinRoom therefore locks the Room
 * row with SELECT ... FOR UPDATE and counts inside the same transaction, so
 * the second caller waits and sees the true count. A partial unique index
 * on (room_id, user_id) WHERE left_at IS NULL backs that up at the schema
 * level.
 */

export type RoomResult = { ok: true; roomId: string } | { ok: false; error: string };
export type SimpleResult = { ok: true } | { ok: false; error: string };

const createSchema = z.object({
  title: z.string().trim().min(1, "Give your room a title").max(60, "Keep the title under 60 characters"),
  topic: z.string().trim().min(1, "Choose or type a topic").max(80),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  maxSize: z.number().int().min(MIN_ROOM_SIZE, "Rooms need at least 2 seats").max(MAX_ROOM_SIZE),
});

export async function createRoom(input: {
  title: string;
  topic: string;
  level: string;
  maxSize: number;
}): Promise<RoomResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please log in again." };
  const userId = session.user.id;

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "That room is not valid." };
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { isAdult: true } });
  if (!user?.isAdult) return { ok: false, error: "Group rooms are 18+ for now." };

  // One live room per host, and never while on a one-to-one call.
  const [existingRoom, inCall] = await Promise.all([
    db.room.findFirst({
      where: { hostId: userId, closedAt: null },
      select: { id: true },
    }),
    db.match.findFirst({
      where: { endedAt: null, OR: [{ userAId: userId }, { userBId: userId }] },
      select: { id: true },
    }),
  ]);
  if (existingRoom) {
    return { ok: false, error: "You already have a room open. Close it before starting another." };
  }
  if (inCall) return { ok: false, error: "You're in a call right now. Finish it first." };

  const room = await db.$transaction(async (tx) => {
    const created = await tx.room.create({
      data: {
        title: parsed.data.title,
        topic: parsed.data.topic,
        level: parsed.data.level,
        hostId: userId,
        maxSize: parsed.data.maxSize,
      },
      select: { id: true },
    });
    await tx.roomParticipant.create({ data: { roomId: created.id, userId } });
    return created;
  });

  revalidatePath("/dashboard");
  return { ok: true, roomId: room.id };
}

export async function joinRoom(roomId: string): Promise<SimpleResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please log in again." };
  const userId = session.user.id;

  const parsed = z.string().min(1).safeParse(roomId);
  if (!parsed.success) return { ok: false, error: "That room is not available." };

  try {
    const outcome = await db.$transaction(async (tx) => {
      // Lock the room row: everything below must see a consistent count.
      const locked = await tx.$queryRaw<{ id: string; host_id: string; max_size: number; closed_at: Date | null }[]>`
        SELECT id, host_id, max_size, closed_at FROM rooms WHERE id = ${parsed.data} FOR UPDATE
      `;
      const room = locked[0];
      if (!room) return { ok: false as const, error: "That room no longer exists." };
      if (room.closed_at) return { ok: false as const, error: "That room has closed." };

      // Blocking is symmetric: neither direction may share a room.
      const blocked = await tx.block.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: room.host_id },
            { blockerId: room.host_id, blockedId: userId },
          ],
        },
        select: { id: true },
      });
      if (blocked) return { ok: false as const, error: "That room is not available." };

      // Already in? Rejoining is a no-op, not an error.
      const mine = await tx.roomParticipant.findFirst({
        where: { roomId: room.id, userId, leftAt: null },
        select: { id: true },
      });
      if (mine) return { ok: true as const };

      const live = await tx.roomParticipant.count({
        where: { roomId: room.id, leftAt: null },
      });
      if (live >= room.max_size) {
        return { ok: false as const, error: "That room is full." };
      }

      await tx.roomParticipant.create({ data: { roomId: room.id, userId } });
      return { ok: true as const };
    });

    if (outcome.ok) revalidatePath("/dashboard");
    return outcome;
  } catch {
    // The partial unique index rejects a duplicate live row; that means the
    // user is already in, which is success from their point of view.
    return { ok: true };
  }
}

export async function leaveRoom(roomId: string): Promise<SimpleResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please log in again." };
  const userId = session.user.id;

  await db.$transaction(async (tx) => {
    await tx.roomParticipant.updateMany({
      where: { roomId, userId, leftAt: null },
      data: { leftAt: new Date() },
    });

    // Last one out closes the room.
    const remaining = await tx.roomParticipant.count({ where: { roomId, leftAt: null } });
    if (remaining === 0) {
      await tx.room.updateMany({
        where: { id: roomId, closedAt: null },
        data: { closedAt: new Date(), closeReason: "empty" },
      });
    }
  });

  revalidatePath("/dashboard");
  return { ok: true };
}
