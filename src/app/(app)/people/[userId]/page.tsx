import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPersonProfile } from "@/server/people";
import { interestLabel } from "@/lib/interests";
import { LevelBadge } from "@/components/level-badge";
import { PersonActions } from "./person-actions";
import { PresenceDot } from "./presence-dot";

export const metadata = { title: "Profile — SpeakUp" };

export default async function PersonPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const person = await getPersonProfile(userId, session.user.id);
  if (!person) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="text-4xl" aria-hidden>🔍</span>
        <h1 className="text-xl font-bold">Profile not available</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This person is not in your directory. They may have left, or one of you blocked the
          other.
        </p>
        <Link href="/people" className="text-sm underline underline-offset-4">
          Back to people
        </Link>
      </main>
    );
  }

  const minutes = Math.round((person.stats?.totalSeconds ?? 0) / 60);
  const memberSince = person.createdAt.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-md space-y-6 p-4 md:p-8">
      <Link href="/people" className="text-sm text-muted-foreground underline underline-offset-4">
        ← People
      </Link>

      <section className="space-y-3 text-center">
        <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-accent text-4xl font-bold">
          {person.name.charAt(0).toUpperCase()}
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{person.name}</h1>
          <div className="flex items-center justify-center gap-2">
            {person.cefrLevel && <LevelBadge level={person.cefrLevel} />}
            <PresenceDot userId={person.id} lastSeenAt={person.lastSeenAt?.toISOString() ?? null} />
          </div>
        </div>
        {person.bio && <p className="text-sm text-muted-foreground">{person.bio}</p>}
      </section>

      {person.interests.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Interests</h2>
          <div className="flex flex-wrap gap-2">
            {person.interests.map((interest) => (
              <span key={interest} className="rounded-full bg-accent px-3 py-1 text-sm">
                {interestLabel(interest)}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border p-3">
          <p className="text-xl font-bold">{minutes}</p>
          <p className="text-xs text-muted-foreground">minutes practised</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-xl font-bold">{person.stats?.sessionsCount ?? 0}</p>
          <p className="text-xs text-muted-foreground">conversations</p>
        </div>
        <div className="rounded-xl border p-3">
          {/* Withheld below three ratings: an average of one is not a rating. */}
          <p className="text-xl font-bold">
            {person.averageRating ? `${person.averageRating.toFixed(1)}★` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {person.averageRating ? "average rating" : "not rated yet"}
          </p>
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground">Member since {memberSince}</p>

      <PersonActions userId={person.id} name={person.name} />
    </main>
  );
}
