import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDirectory } from "@/server/people";
import { PeopleDirectory } from "./people-directory";

export const metadata = { title: "People — SpeakUp" };

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; level?: string }>;
}) {
  const { q, level } = await searchParams;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { onboardedAt: true, isAdult: true },
  });
  if (!user) redirect("/login");
  if (!user.onboardedAt) redirect("/onboarding");

  if (!user.isAdult) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="text-4xl" aria-hidden>🧑‍🤝‍🧑</span>
        <h1 className="text-xl font-bold">Partner practice is 18+</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Talking with strangers is limited to adults for now. Your AI partner is available any
          time.
        </p>
      </main>
    );
  }

  const { people, hasMore, total } = await getDirectory({ search: q, level, page: 0 });

  return (
    <PeopleDirectory
      // Remount on any filter change so the loaded pages reset cleanly.
      key={`${q ?? ""}|${level ?? ""}`}
      initialPeople={people}
      initialHasMore={hasMore}
      total={total}
      search={q ?? ""}
      level={level ?? ""}
    />
  );
}
