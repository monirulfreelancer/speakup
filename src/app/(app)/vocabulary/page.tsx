export const metadata = { title: "Vocabulary — SpeakUp" };

// Placeholder — the real vocabulary feature is a later phase.
export default function VocabularyPage() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="text-4xl" aria-hidden>
        📖
      </span>
      <h1 className="text-xl font-bold">Vocabulary</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Soon you’ll be able to save words from your conversations and review them here.
      </p>
    </main>
  );
}
