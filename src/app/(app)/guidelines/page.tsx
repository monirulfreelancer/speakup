export const metadata = { title: "Community Guidelines — SpeakUp" };

export default function GuidelinesPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <h1 className="text-2xl font-bold">Community Guidelines</h1>
      <p className="text-muted-foreground">
        SpeakUp works because people feel safe practicing — making mistakes out loud, in front of
        someone else, in a language they’re still learning. These rules protect that.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Be respectful</h2>
        <p className="text-sm text-muted-foreground">
          Every partner you meet here is doing something brave. Be patient with slow speech,
          mistakes, and accents — yours are being treated the same way. Harassment, insults,
          discrimination, and sexual content have no place here and lead to removal.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Keep it in English</h2>
        <p className="text-sm text-muted-foreground">
          The whole point of SpeakUp is time spent speaking English. Slipping into your native
          language for a word is human; conducting the conversation in it defeats the practice —
          for both of you. The app will remind you (gently or strictly, depending on your
          settings) when it hears another language.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Reporting</h2>
        <p className="text-sm text-muted-foreground">
          When partner conversations launch, every call will have a report button. Reporting ends
          the call immediately and sends the recent conversation context to our moderators.
          Repeated reports against an account suspend its access to partner calls while we
          review. You’ll also be able to block anyone, permanently, no questions asked.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Your data</h2>
        <p className="text-sm text-muted-foreground">
          Your speech is transcribed to power practice features, and your transcripts are visible
          only to you. A conversation partner never sees your transcript.
        </p>
      </section>
    </main>
  );
}
