"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/*
 * Session lifecycle for AI practice. Phase 6 extends this with heartbeats,
 * streaks and abandoned-session cleanup; the shapes here are built not to
 * need restructuring then.
 */

export type StartSessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

export async function startAiSession(topicId: string | null): Promise<StartSessionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in" };

  const parsed = z.string().cuid().nullable().safeParse(topicId);
  if (!parsed.success) return { ok: false, error: "Unknown topic" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { cefrLevel: true, onboardedAt: true },
  });
  if (!user?.onboardedAt || !user.cefrLevel) return { ok: false, error: "Finish onboarding first" };

  // One live session at a time: close anything stale as ABANDONED, crediting
  // the time that actually elapsed.
  const stale = await db.practiceSession.findMany({
    where: { userId: session.user.id, status: "ACTIVE" },
    select: { id: true, startedAt: true },
  });
  const now = new Date();
  for (const s of stale) {
    await db.practiceSession.update({
      where: { id: s.id },
      data: {
        status: "ABANDONED",
        endedAt: now,
        durationSeconds: Math.max(0, Math.floor((now.getTime() - s.startedAt.getTime()) / 1000)),
      },
    });
  }

  const practiceSession = await db.practiceSession.create({
    data: {
      userId: session.user.id,
      mode: "AI",
      topicId: parsed.data,
      levelAtSession: user.cefrLevel,
    },
  });

  return { ok: true, sessionId: practiceSession.id };
}

export async function endAiSession(sessionId: string): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };

  const parsed = z.string().cuid().safeParse(sessionId);
  if (!parsed.success) return { ok: false };

  const practiceSession = await db.practiceSession.findFirst({
    where: { id: parsed.data, userId: session.user.id, status: "ACTIVE" },
    select: { id: true, startedAt: true },
  });
  if (!practiceSession) return { ok: false };

  const now = new Date();
  const durationSeconds = Math.max(
    0,
    Math.floor((now.getTime() - practiceSession.startedAt.getTime()) / 1000),
  );

  await db.$transaction([
    db.practiceSession.update({
      where: { id: practiceSession.id },
      data: { status: "COMPLETED", endedAt: now, durationSeconds },
    }),
    // Streaks and the rest of the stats model land in Phase 6.
    db.userStats.update({
      where: { userId: session.user.id },
      data: {
        totalSeconds: { increment: durationSeconds },
        sessionsCount: { increment: 1 },
        aiSessions: { increment: 1 },
      },
    }),
  ]);

  return { ok: true };
}
