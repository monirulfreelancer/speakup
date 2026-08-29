import Link from "next/link";
import { redirect } from "next/navigation";
import { Flame, Clock, MessageCircle, Users, Mic, ArrowRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { InstallPrompt } from "@/components/pwa/install-prompt";

export const metadata = { title: "Home — SpeakUp" };

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/*
 * Streak = consecutive days, counting back from today, on which the user
 * completed at least one session. Computed from the sessions themselves
 * rather than read from UserStats.currentStreak, which nothing maintains
 * and which would therefore always read zero.
 */
function streakFromDays(days: Date[]): number {
  if (days.length === 0) return 0;
  const asKey = (d: Date) => d.toISOString().slice(0, 10);
  const seen = new Set(days.map(asKey));

  const cursor = new Date();
  // Practising yesterday but not yet today still counts as a live streak.
  if (!seen.has(asKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (seen.has(asKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      avatarUpdatedAt: true,
      cefrLevel: true,
      onboardedAt: true,
      isAdult: true,
      stats: true,
    },
  });
  if (!user) redirect("/login");
  if (!user.onboardedAt || !user.cefrLevel) redirect("/onboarding");

  const completed = await db.practiceSession.findMany({
    where: { userId: session.user.id, status: "COMPLETED" },
    select: { startedAt: true },
    orderBy: { startedAt: "desc" },
    take: 400,
  });

  const streak = streakFromDays(completed.map((s) => s.startedAt));
  const minutes = Math.round((user.stats?.totalSeconds ?? 0) / 60);
  const conversations = user.stats?.sessionsCount ?? 0;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-4 md:p-8">
      <InstallPrompt eligible={conversations >= 1} />

      <header className="flex items-center gap-3">
        <Avatar
          user={{
            id: session.user.id,
            displayName: user.name,
            avatarUpdatedAt: user.avatarUpdatedAt,
          }}
          size={56}
          priority
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-muted">{greeting()},</p>
          <h1 className="truncate text-2xl">{user.name}</h1>
        </div>
        <Badge level={user.cefrLevel} />
      </header>

      <section aria-label="Your progress" className="grid grid-cols-3 gap-3">
        <StatTile icon={Flame} value={streak} label="day streak" tone="warning" />
        <StatTile icon={Clock} value={minutes} label="minutes" tone="primary" />
        <StatTile icon={MessageCircle} value={conversations} label="conversations" />
      </section>

      {/* The one obvious thing to do next. */}
      <section className="space-y-3">
        {user.isAdult ? (
          <Link
            href="/people"
            className="btn-3d flex min-h-32 items-center gap-4 rounded-3xl bg-primary p-5 text-on-primary [--btn-edge:var(--primary-dark)] active:btn-3d-press"
          >
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-on-primary/20">
              <Users className="size-7" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xl font-extrabold">Find someone to talk to</span>
              <span className="block text-sm opacity-90">
                Browse learners at your level and start a call
              </span>
            </span>
            <ArrowRight className="size-6 shrink-0" aria-hidden />
          </Link>
        ) : (
          <div className="flex min-h-32 items-center gap-4 rounded-3xl border-2 border-dashed border-line p-5">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-surface-raised">
              <Users className="size-7 text-muted" aria-hidden />
            </span>
            <span>
              <span className="block text-lg font-extrabold">Partner practice is 18+</span>
              <span className="block text-sm text-muted">
                Talking with strangers is limited to adults for now.
              </span>
            </span>
          </div>
        )}

        {env.AI_MODE_ENABLED && (
          <Link
            href="/practice/ai"
            className="flex min-h-16 items-center gap-3 rounded-2xl border-2 border-line bg-surface p-4 font-bold transition-colors hover:bg-surface-raised"
          >
            <Mic className="size-5 text-primary" aria-hidden />
            Practice with the AI partner
            <ArrowRight className="ml-auto size-5 text-muted" aria-hidden />
          </Link>
        )}
      </section>
    </main>
  );
}
