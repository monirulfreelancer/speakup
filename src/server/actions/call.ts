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
