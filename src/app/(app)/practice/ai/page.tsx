import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PracticeFlow } from "./practice-flow";

export const metadata = { title: "Practice — SpeakUp" };

const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export default async function PracticeAiPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { cefrLevel: true, onboardedAt: true },
  });
  if (!user) redirect("/login");
  if (!user.onboardedAt || !user.cefrLevel) redirect("/onboarding");

  const levelIndex = LEVEL_ORDER.indexOf(user.cefrLevel);
  const topics = (
    await db.topic.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, description: true, icon: true, minLevel: true, maxLevel: true },
    })
  ).filter(
    (t) =>
      LEVEL_ORDER.indexOf(t.minLevel) <= levelIndex && levelIndex <= LEVEL_ORDER.indexOf(t.maxLevel),
  );

  return (
    <PracticeFlow
      topics={topics.map(({ id, title, description, icon }) => ({ id, title, description, icon }))}
      level={user.cefrLevel}
    />
  );
}
