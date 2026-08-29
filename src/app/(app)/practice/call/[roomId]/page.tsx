import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CallScreen } from "./call-screen";

export const metadata = { title: "Call — SpeakUp" };

/*
 * Server-side room authorisation. The realtime service checks membership
 * again on every signaling event; this check exists so an unauthorised
 * roomId shows a plain error page instead of an empty call screen.
 */
export default async function CallPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const match = await db.match.findFirst({
    where: {
      roomId,
      endedAt: null,
      OR: [{ userAId: session.user.id }, { userBId: session.user.id }],
    },
    select: { id: true, userAId: true, userBId: true, topicId: true },
  });

  if (!match) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="text-4xl" aria-hidden>🔍</span>
        <h1 className="text-xl font-bold">That call is not available</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          It has already ended, or it belongs to someone else. Find a new partner to start another
          conversation.
        </p>
        <a href="/practice/human" className="text-sm underline underline-offset-4">
          Find a partner
        </a>
      </main>
    );
  }

  const partnerId = match.userAId === session.user.id ? match.userBId : match.userAId;
  const [partner, topic] = await Promise.all([
    db.user.findUnique({
      where: { id: partnerId },
      select: { name: true, avatarUpdatedAt: true, cefrLevel: true },
    }),
    match.topicId
      ? db.topic.findUnique({ where: { id: match.topicId }, select: { title: true, icon: true } })
      : Promise.resolve(null),
  ]);

  return (
    <CallScreen
      roomId={roomId}
      matchId={match.id}
      selfUserId={session.user.id}
      partnerUserId={partnerId}
      partnerName={partner?.name ?? "Your partner"}
      partnerAvatarUpdatedAt={partner?.avatarUpdatedAt?.toISOString() ?? null}
      partnerLevel={partner?.cefrLevel ?? null}
      topic={topic}
      // user A created the Match, so they are the caller.
      role={match.userAId === session.user.id ? "caller" : "callee"}
    />
  );
}
