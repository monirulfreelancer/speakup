"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/*
 * Post-call actions: rate, report, block. All three re-authenticate and
 * verify the caller was actually in the match — a rating or report is a
 * claim about a specific conversation, and only its participants may make
 * one.
 */

export type CallActionResult = { ok: true } | { ok: false; error: string };

async function partnerInMatch(
  matchId: string,
  userId: string,
): Promise<{ partnerId: string } | null> {
  const match = await db.match.findFirst({
    where: { id: matchId, OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true },
  });
  if (!match) return null;
  return { partnerId: match.userAId === userId ? match.userBId : match.userAId };
}

export async function ratePartner(matchId: string, rating: number): Promise<CallActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in" };

  const parsed = z.object({ matchId: z.string(), rating: z.number().int().min(1).max(5) }).safeParse({ matchId, rating });
  if (!parsed.success) return { ok: false, error: "Invalid rating" };

  const partner = await partnerInMatch(parsed.data.matchId, session.user.id);
  if (!partner) return { ok: false, error: "That call is not yours to rate" };

  await db.partnerRating.upsert({
    where: { matchId_raterId: { matchId: parsed.data.matchId, raterId: session.user.id } },
    create: {
      matchId: parsed.data.matchId,
      raterId: session.user.id,
      rateeId: partner.partnerId,
      rating: parsed.data.rating,
    },
    update: { rating: parsed.data.rating },
  });
  return { ok: true };
}

const REASONS = [
  "INAPPROPRIATE_LANGUAGE",
  "HARASSMENT",
  "NO_ENGLISH",
  "SEXUAL_CONTENT",
  "SPAM",
  "OTHER",
] as const;

export async function reportPartner(input: {
  matchId: string;
  reason: string;
  note?: string;
}): Promise<CallActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in" };

  const parsed = z
    .object({
      matchId: z.string(),
      reason: z.enum(REASONS),
      note: z.string().max(1000).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please choose a reason" };

  const partner = await partnerInMatch(parsed.data.matchId, session.user.id);
  if (!partner) return { ok: false, error: "That call is not yours to report" };

  await db.report.create({
    data: {
      reporterId: session.user.id,
      reportedId: partner.partnerId,
      matchId: parsed.data.matchId,
      reason: parsed.data.reason,
      note: parsed.data.note,
    },
  });
  return { ok: true };
}

export async function blockPartner(matchId: string): Promise<CallActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in" };

  const partner = await partnerInMatch(matchId, session.user.id);
  if (!partner) return { ok: false, error: "That call is not yours" };

  // The matcher excludes blocked pairs in both directions, so one row is
  // enough to guarantee they are never paired again.
  await db.block.upsert({
    where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: partner.partnerId } },
    create: { blockerId: session.user.id, blockedId: partner.partnerId },
    update: {},
  });
  return { ok: true };
}

/*
 * Starting a call from the directory.
 *
 * Creates the Match up front so both sides have a room to join before any
 * ringing happens, then the caller navigates to the call screen and the
 * realtime service rings the target's user room.
 */

const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

/** Attempts allowed per minute, and the cooldown after being declined. */
const MAX_CALLS_PER_MINUTE = 5;
const DECLINE_COOLDOWN_SECONDS = 60;

export type StartCallResult =
  | { ok: true; roomId: string }
  | { ok: false; error: string }
  /* A genuinely live call: the UI offers to return to it or end it, rather
     than showing a dead end. */
  | { ok: false; error: string; busyRoomId: string; busyIsMine: true };

/*
 * Closes this user's stale matches before any busy check. The realtime
 * sweep does the same on a timer, but a user pressing Call should not have
 * to wait up to a minute for it — and the sweep does not run at all if the
 * realtime service is down.
 *
 * Same definition as the sweep: never answered and older than 3 minutes.
 */
async function closeStaleMatchesFor(userId: string): Promise<void> {
  await db.match.updateMany({
    where: {
      endedAt: null,
      answeredAt: null,
      startedAt: { lt: new Date(Date.now() - 3 * 60 * 1000) },
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    data: { endedAt: new Date(), endReason: "abandoned" },
  });
}

export async function startCall(targetUserId: string): Promise<StartCallResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please log in again." };
  const callerId = session.user.id;

  const parsed = z.string().min(1).safeParse(targetUserId);
  if (!parsed.success || parsed.data === callerId) {
    return { ok: false, error: "That person is not available." };
  }

  const [caller, target] = await Promise.all([
    db.user.findUnique({
      where: { id: callerId },
      select: { cefrLevel: true, isAdult: true },
    }),
    db.user.findFirst({
      where: { id: parsed.data, onboardedAt: { not: null } },
      select: { id: true, name: true, cefrLevel: true },
    }),
  ]);
  if (!caller?.isAdult) return { ok: false, error: "Partner practice is 18+ for now." };
  if (!target) return { ok: false, error: "That person is not available." };

  // Blocking is symmetric: neither direction may call.
  const blocked = await db.block.findFirst({
    where: {
      OR: [
        { blockerId: callerId, blockedId: target.id },
        { blockerId: target.id, blockedId: callerId },
      ],
    },
    select: { id: true },
  });
  if (blocked) return { ok: false, error: "That person is not available." };

  const now = new Date();

  // Rate limit: 5 attempts a minute, counted from Match rows so it survives
  // a restart and holds across instances.
  const recentAttempts = await db.match.count({
    where: { userAId: callerId, startedAt: { gte: new Date(now.getTime() - 60_000) } },
  });
  if (recentAttempts >= MAX_CALLS_PER_MINUTE) {
    return {
      ok: false,
      error: "You are calling very quickly. Wait a minute, then try again.",
    };
  }

  // Someone who declined you gets a minute of peace before you can ring again.
  const recentDecline = await db.match.findFirst({
    where: {
      userAId: callerId,
      userBId: target.id,
      endReason: "declined",
      endedAt: { gte: new Date(now.getTime() - DECLINE_COOLDOWN_SECONDS * 1000) },
    },
    select: { id: true },
  });
  if (recentDecline) {
    return {
      ok: false,
      error: `${target.name} just declined. You can try again in a minute.`,
    };
  }

  // Clear anything stale FIRST, so a dead row from a call that was never
  // answered cannot lock either side out.
  await Promise.all([closeStaleMatchesFor(callerId), closeStaleMatchesFor(target.id)]);

  // Busy checks, both directions — now only genuinely live calls remain.
  const [callerBusy, targetBusy] = await Promise.all([
    db.match.findFirst({
      where: { endedAt: null, OR: [{ userAId: callerId }, { userBId: callerId }] },
      select: { id: true, roomId: true },
    }),
    db.match.findFirst({
      where: { endedAt: null, OR: [{ userAId: target.id }, { userBId: target.id }] },
      select: { id: true },
    }),
  ]);
  if (callerBusy) {
    return {
      ok: false,
      error: "You're already in a call.",
      busyRoomId: callerBusy.roomId,
      busyIsMine: true,
    };
  }
  if (targetBusy) return { ok: false, error: `${target.name} is in a call right now.` };

  // Topic pitched at the LOWER of the two levels, so the weaker speaker is
  // never the one struggling with the subject as well as the language.
  const callerIndex = LEVEL_ORDER.indexOf(caller.cefrLevel ?? "B1");
  const targetIndex = LEVEL_ORDER.indexOf(target.cefrLevel ?? "B1");
  const lower = LEVEL_ORDER[Math.min(callerIndex, targetIndex)];

  // Prisma enum fields have no lte/gte, so the range test uses the declared
  // level order in code.
  const lowerIndex = LEVEL_ORDER.indexOf(lower);
  const allTopics = await db.topic.findMany({
    where: { isActive: true },
    select: { id: true, minLevel: true, maxLevel: true },
  });
  const eligible = allTopics.filter(
    (t) =>
      LEVEL_ORDER.indexOf(t.minLevel) <= lowerIndex &&
      lowerIndex <= LEVEL_ORDER.indexOf(t.maxLevel),
  );
  const topic = eligible.length > 0 ? eligible[Math.floor(Math.random() * eligible.length)] : null;

  const match = await db.match.create({
    data: {
      roomId: `room_${crypto.randomUUID()}`,
      userAId: callerId,
      userBId: target.id,
      topicId: topic?.id ?? null,
    },
    select: { roomId: true },
  });

  return { ok: true, roomId: match.roomId };
}

/** Ends the caller's own live call, for the "End that call" action. */
export async function endMyCall(): Promise<CallActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in" };

  const live = await db.match.findFirst({
    where: { endedAt: null, OR: [{ userAId: session.user.id }, { userBId: session.user.id }] },
    select: { id: true, startedAt: true },
  });
  if (!live) return { ok: true };

  await db.match.update({
    where: { id: live.id },
    data: {
      endedAt: new Date(),
      endReason: "hangup",
      durationSeconds: Math.max(0, Math.floor((Date.now() - live.startedAt.getTime()) / 1000)),
    },
  });
  return { ok: true };
}
