import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { InstallSettingsEntry } from "@/components/pwa/install-settings-entry";
import { ProfileForm } from "@/components/profile-form";
import {
  EnforcementModePicker,
  NotificationsToggle,
  TtsControls,
  UiLanguageSelect,
} from "./settings-forms";

export const metadata = { title: "Settings — SpeakUp" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      bio: true,
      interests: true,
      avatarUpdatedAt: true,
      cefrLevel: true,
      enforcementMode: true,
      onboardedAt: true,
      settings: true,
    },
  });
  if (!user) redirect("/login");
  if (!user.onboardedAt || !user.cefrLevel) redirect("/onboarding");

  const settings = user.settings;

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-4 md:p-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Your profile</h2>
          <p className="text-sm text-muted-foreground">
            What other learners see when they find you in the directory.
          </p>
        </div>
        <ProfileForm
          userId={session.user.id}
          initialName={user.name}
          initialBio={user.bio ?? ""}
          initialInterests={user.interests}
          initialLevel={user.cefrLevel}
          initialAvatarUpdatedAt={user.avatarUpdatedAt?.toISOString() ?? null}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">English-only reminders</h2>
          <p className="text-sm text-muted-foreground">
            What happens when you slip into your native language.
          </p>
        </div>
        <EnforcementModePicker current={user.enforcementMode} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Voice</h2>
        <TtsControls
          initialVoice={settings?.ttsVoice ?? null}
          initialRate={settings?.ttsRate ?? 1.0}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">App</h2>
        <UiLanguageSelect current={settings?.uiLanguage ?? "en"} />
        <NotificationsToggle initial={settings?.notificationsEnabled ?? false} />
        <InstallSettingsEntry />
      </section>

      <section className="border-t pt-6">
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button variant="outline" type="submit" className="h-11 w-full sm:w-auto">
            Sign out
          </Button>
        </form>
      </section>
    </main>
  );
}
