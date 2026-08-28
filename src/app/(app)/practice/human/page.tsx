import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { FindPartner } from "./find-partner";

export const metadata = { title: "Find a partner — SpeakUp" };

export default async function PracticeHumanPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { cefrLevel: true, isAdult: true, onboardedAt: true },
  });
  if (!user) redirect("/login");
  if (!user.onboardedAt || !user.cefrLevel) redirect("/onboarding");

  if (!user.isAdult) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="text-4xl" aria-hidden>🧑‍🤝‍🧑</span>
        <h1 className="text-xl font-bold">Partner practice is 18+</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Talking with strangers is limited to adults for now. Your AI partner is available any
          time — and it never judges.
        </p>
      </main>
    );
  }

  return <FindPartner level={user.cefrLevel} />;
}
