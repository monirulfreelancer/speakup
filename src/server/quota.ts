import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/*
 * Rate limiting and the daily minute quota, both computed from the database
 * rather than in-memory counters — correct across server restarts and
 * multiple instances, and no new tables needed (Phase 8 adds a dedicated
 * DailyUsage model; this is the interim, DB-backed version).
 *
 * - Rate limit: max 60 user turns per rolling hour.
 * - Daily quota: DAILY_MINUTES_QUOTA minutes of practice per UTC day,
 *   measured as completed session durations today plus the live session's
 *   elapsed time.
 */

export const HOURLY_REQUEST_LIMIT = 60;

export type QuotaCheck =
  | { ok: true }
  | { ok: false; reason: "rate" | "quota"; message: string; resetAt: Date };

export async function checkPracticeQuota(userId: string): Promise<QuotaCheck> {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const nextDay = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [recentTurns, todaySessions] = await Promise.all([
    db.sessionTurn.count({
      where: {
        speaker: "USER",
        createdAt: { gte: hourAgo },
        session: { userId },
      },
    }),
    db.practiceSession.findMany({
      where: { userId, startedAt: { gte: dayStart } },
      select: { durationSeconds: true, status: true, startedAt: true },
    }),
  ]);

  if (recentTurns >= HOURLY_REQUEST_LIMIT) {
    const oldest = await db.sessionTurn.findFirst({
      where: { speaker: "USER", createdAt: { gte: hourAgo }, session: { userId } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    const resetAt = new Date((oldest?.createdAt ?? now).getTime() + 60 * 60 * 1000);
    return {
      ok: false,
      reason: "rate",
      message: "You're practicing fast! Take a short break — you can continue soon.",
      resetAt,
    };
  }

  const usedSeconds = todaySessions.reduce((sum, s) => {
    if (s.status === "ACTIVE") {
      return sum + Math.max(0, Math.floor((now.getTime() - s.startedAt.getTime()) / 1000));
    }
    return sum + s.durationSeconds;
  }, 0);

  if (usedSeconds >= env.DAILY_MINUTES_QUOTA * 60) {
    return {
      ok: false,
      reason: "quota",
      message: `You've used your ${env.DAILY_MINUTES_QUOTA} practice minutes for today — great work! Come back tomorrow.`,
      resetAt: nextDay,
    };
  }

  return { ok: true };
}
