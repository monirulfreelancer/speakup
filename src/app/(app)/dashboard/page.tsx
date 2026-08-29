import { redirect } from "next/navigation";
import { Flame, Clock, MessageCircle, Mic, ArrowRight } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getDirectory } from "@/server/people";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { PeopleDirectory } from "@/components/people-directory";
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

/*
 * Home IS the directory. There is nothing to tap through to: the people you
 * can call are the page, with the greeting and stats as a slim strip above
 * them.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; level?: string }>;
}) {
  const { q, level } = await searchParams;

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

  const [completed, directory] = await Promise.all([
    db.practiceSession.findMany({
      where: { userId: session.user.id, status: "COMPLETED" },
      select: { startedAt: true },
      orderBy: { startedAt: "desc" },
      take: 400,
    }),
    user.isAdult
      ? getDirectory({ search: q, level, page: 0 })
      : Promise.resolve({ people: [], hasMore: false, total: 0 }),
  ]);

  const streak = streakFromDays(completed.map((s) => s.startedAt));
  const minutes = Math.round((user.stats?.totalSeconds ?? 0) / 60);
  const conversations = user.stats?.sessionsCount ?? 0;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 p-4 md:p-8">
      <InstallPrompt eligible={conversations >= 1} />

      {/* Compact: one row, no wasted vertical space above the list. */}
      <header className="flex items-center gap-3">
        <Avatar
          user={{
            id: session.user.id,
            displayName: user.name,
            avatarUpdatedAt: user.avatarUpdatedAt,
          }}
          size={44}
          priority
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted">{greeting()},</p>
          <h1 className="truncate text-lg">{user.name}</h1>
        </div>
        <Badge level={user.cefrLevel} />
      </header>

      <section aria-label="Your progress" className="grid grid-cols-3 gap-2">
        <StatTile icon={Flame} value={streak} label="day streak" tone="warning" compact />
        <StatTile icon={Clock} value={minutes} label="minutes" tone="primary" compact />
        <StatTile icon={MessageCircle} value={conversations} label="calls" compact />
      </section>

      {env.AI_MODE_ENABLED && (
        <Link
          href="/practice/ai"
          className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-line bg-surface p-4 font-bold transition-colors hover:bg-surface-raised"
        >
          <Mic className="size-5 text-primary" aria-hidden />
          Practice with the AI partner
          <ArrowRight className="ml-auto size-5 text-muted" aria-hidden />
        </Link>
      )}

      {user.isAdult ? (
        <>
          <h2 className="pt-1 text-lg">Talk with someone</h2>
          <PeopleDirectory
            // Remount on any filter change so the loaded pages reset cleanly.
            key={`${q ?? ""}|${level ?? ""}`}
            initialPeople={directory.people}
            initialHasMore={directory.hasMore}
            total={directory.total}
            search={q ?? ""}
            level={level ?? ""}
          />
        </>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-line p-6 text-center">
          <p className="font-bold">Partner practice is 18+</p>
          <p className="pt-1 text-sm text-muted">
            Talking with strangers is limited to adults for now.
          </p>
        </div>
      )}
    </main>
  );
}
