import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LevelBadge } from "@/components/level-badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Dashboard — SpeakUp" };

function formatSpeakingTime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      photoUrl: true,
      cefrLevel: true,
      onboardedAt: true,
      stats: true,
    },
  });
  if (!user) redirect("/login");
  if (!user.onboardedAt || !user.cefrLevel) redirect("/onboarding");

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const [sessionsThisWeek, recentSessions] = await Promise.all([
    db.practiceSession.count({
      where: { userId: session.user.id, startedAt: { gte: weekStart } },
    }),
    db.practiceSession.findMany({
      where: { userId: session.user.id },
      orderBy: { startedAt: "desc" },
      take: 5,
      include: { topic: { select: { title: true, icon: true } } },
    }),
  ]);

  const stats = user.stats;
  const allZero =
    !stats || (stats.currentStreak === 0 && stats.totalSeconds === 0 && sessionsThisWeek === 0);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <header className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-lg font-bold">
          {user.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoUrl} alt="" className="size-full object-cover" />
          ) : (
            user.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{user.name}</h1>
          <p className="text-sm text-muted-foreground">Ready to practice?</p>
        </div>
        <LevelBadge level={user.cefrLevel} />
      </header>

      {/* Primary actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/practice/ai"
          className="flex min-h-32 flex-col justify-between rounded-2xl bg-primary p-5 text-primary-foreground transition-opacity hover:opacity-90"
        >
          <span className="text-3xl" aria-hidden>
            🤖
          </span>
          <span>
            <span className="block text-lg font-bold">Talk with AI</span>
            <span className="block text-sm opacity-80">Practice any time, no pressure</span>
          </span>
        </Link>
        <div
          aria-disabled
          className="flex min-h-32 flex-col justify-between rounded-2xl border-2 border-dashed p-5 opacity-60"
        >
          <span className="text-3xl" aria-hidden>
            🧑‍🤝‍🧑
          </span>
          <span>
            <span className="block text-lg font-bold">Talk with a Person</span>
            <span className="block text-sm text-muted-foreground">Coming soon</span>
          </span>
        </div>
      </div>

      {/* Stats strip */}
      {allZero ? (
        <Card>
          <CardContent className="px-5 py-1 text-center text-sm text-muted-foreground">
            Your first conversation is waiting — your streak and speaking time will show up here.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="px-4 text-center">
              <p className="text-2xl font-bold">🔥 {stats?.currentStreak ?? 0}</p>
              <p className="text-xs text-muted-foreground">day streak</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 text-center">
              <p className="text-2xl font-bold">{formatSpeakingTime(stats?.totalSeconds ?? 0)}</p>
              <p className="text-xs text-muted-foreground">speaking time</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 text-center">
              <p className="text-2xl font-bold">{sessionsThisWeek}</p>
              <p className="text-xs text-muted-foreground">this week</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent sessions */}
      <section className="space-y-2">
        <h2 className="font-semibold">Recent sessions</h2>
        {recentSessions.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No sessions yet. Tap “Talk with AI” above to start your first conversation.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {recentSessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3">
                <span className="text-xl" aria-hidden>
                  {s.topic?.icon ?? "💬"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.topic?.title ?? "Free talk"}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.startedAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    · {s.mode === "AI" ? "AI partner" : "Human partner"} ·{" "}
                    {Math.max(1, Math.round(s.durationSeconds / 60))} min
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
