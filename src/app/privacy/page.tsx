import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy: what SpeakUp does with your speech",
  description:
    "What speech data SpeakUp processes, what it stores, who can see your transcripts, and how to delete your account.",
  alternates: { canonical: "/privacy" },
};

/*
 * Plain-language privacy page. It describes what the app ACTUALLY does today
 * (browser speech recognition, transcripts stored per user, AI provider
 * round-trip) rather than boilerplate. Update it when behaviour changes,
 * especially when human calls and recap summaries ship.
 */

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold">Privacy</h1>
        <p className="text-sm text-muted-foreground">
          Short version: your practice is yours. Here is exactly what happens to it.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">What we store about you</h2>
        <p className="text-sm text-muted-foreground">
          Your email address, your name, your password (hashed, never in plain text), your English
          level, your native language, and your date of birth. The date of birth is there to keep
          under-13s out and to keep partner calls limited to adults.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Your voice</h2>
        <p className="text-sm text-muted-foreground">
          We do not record or store audio. Your browser turns your speech into text, and only that
          text reaches us. On Chrome and Edge, that speech recognition happens on Google servers,
          which is how those browsers work rather than something the app chooses. If that matters
          to you, Safari does the same job on your device.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Your transcripts</h2>
        <p className="text-sm text-muted-foreground">
          The text of your conversations is saved to your account so you can look back at what you
          practised. Only you can read your transcripts. A conversation partner never sees them,
          and we do not sell them or use them for advertising.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">The AI partner</h2>
        <p className="text-sm text-muted-foreground">
          To reply to you, we send your recent messages in that conversation to an AI provider
          (Anthropic or OpenAI, depending on how the app is configured). We send the conversation
          text only. Your email, name and date of birth are never included.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Talking with other people</h2>
        <p className="text-sm text-muted-foreground">
          When you practise with a real partner, they see your first name, your photo if you added
          one, and your level. They do not see your email or your transcripts. You can block
          someone at any time and you will never be matched with them again.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Deleting your data</h2>
        <p className="text-sm text-muted-foreground">
          Ask us to delete your account and everything attached to it goes with it: your profile,
          your sessions and your transcripts. Self-service deletion is on the list of things to
          build.
        </p>
      </section>

      <p className="border-t pt-4 text-sm text-muted-foreground">
        See also the{" "}
        <Link href="/guidelines" className="underline underline-offset-4">
          community guidelines
        </Link>
        .
      </p>
    </main>
  );
}
