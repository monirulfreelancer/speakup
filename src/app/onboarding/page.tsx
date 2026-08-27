import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "Welcome — SpeakUp" };

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { onboardedAt: true, name: true },
  });
  if (!user) redirect("/login");
  if (user.onboardedAt) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <OnboardingWizard firstName={user.name.split(" ")[0]} />
    </main>
  );
}
