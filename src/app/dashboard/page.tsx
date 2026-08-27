import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Dashboard — SpeakUp" };

// Phase 1 placeholder — the real dashboard is Phase 2. What matters now is
// the guard chain: unauthenticated → /login (proxy), un-onboarded → /onboarding.
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, nativeLanguage: true, cefrLevel: true, onboardedAt: true },
  });
  if (!user) redirect("/login");
  if (!user.onboardedAt) redirect("/onboarding");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold">Welcome, {user.name}!</h1>
      <p className="text-muted-foreground">
        Native language: <strong>{user.nativeLanguage}</strong> · English level:{" "}
        <strong>{user.cefrLevel}</strong>
      </p>
      <p className="text-sm text-muted-foreground">
        Your dashboard is coming in the next phase.
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button variant="outline" type="submit">
          Sign out
        </Button>
      </form>
    </main>
  );
}
