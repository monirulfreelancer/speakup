import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPersonProfile } from "@/server/people";
import { interestLabel } from "@/lib/interests";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { Chip } from "@/components/ui/chip";
import { ArrowLeft, Clock, MessageCircle, Star, UserX } from "lucide-react";
import { Avatar } from "@/components/avatar";
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
        <span className="flex size-14 items-center justify-center rounded-full bg-surface-raised">
          <UserX className="size-7 text-muted" aria-hidden />
        </span>
        <h1 className="text-xl">Profile not available</h1>
        <p className="max-w-sm text-sm text-muted">
          This person is not in your directory. They may have left, or one of you blocked the
          other.
        </p>
        <Link href="/" className="text-sm font-bold text-primary underline underline-offset-4">
          Back to Home
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
    <main className="mx-auto w-full max-w-md space-y-6 p-4 md:p-8">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Home
      </Link>

      <section className="space-y-3 text-center">
        <Avatar
          user={{ id: person.id, displayName: person.name, avatarUpdatedAt: person.avatarUpdatedAt }}
          size={96}
          className="mx-auto"
          priority
        />
        <div className="space-y-2">
          <h1 className="text-2xl">{person.name}</h1>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {person.cefrLevel && <Badge level={person.cefrLevel} />}
            <PresenceDot userId={person.id} lastSeenAt={person.lastSeenAt?.toISOString() ?? null} />
          </div>
        </div>
        {person.bio && <p className="text-sm text-muted">{person.bio}</p>}
      </section>

      {person.interests.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-extrabold text-muted">Interests</h2>
          <div className="flex flex-wrap gap-2">
            {person.interests.map((interest) => (
              <Chip key={interest} label={interestLabel(interest)} />
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-3 gap-2">
        <StatTile icon={Clock} value={minutes} label="minutes" tone="primary" />
        <StatTile icon={MessageCircle} value={person.stats?.sessionsCount ?? 0} label="calls" />
        {/* Withheld below three ratings: an average of one is not a rating. */}
        <StatTile
          icon={Star}
          value={person.averageRating ? person.averageRating.toFixed(1) : "—"}
          label={person.averageRating ? "rating" : "not rated"}
          tone={person.averageRating ? "warning" : "default"}
        />
      </section>

      <p className="text-center text-xs font-semibold text-muted">Member since {memberSince}</p>

      <PersonActions userId={person.id} name={person.name} />
    </main>
  );
}
