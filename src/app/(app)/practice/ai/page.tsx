export const metadata = { title: "Practice — SpeakUp" };

// Placeholder — the real AI conversation loop arrives with the speech and AI
// phases. Routing here from the dashboard already works.
export default function PracticeAiPage() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="text-4xl" aria-hidden>
        🤖
      </span>
      <h1 className="text-xl font-bold">AI practice is almost ready</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This is where you’ll talk with your AI conversation partner. The microphone and voice
        features are coming in the next phases.
      </p>
    </main>
  );
}
