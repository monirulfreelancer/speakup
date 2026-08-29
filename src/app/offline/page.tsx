export const metadata = { title: "Offline — SpeakUp" };

// Served by the service worker when a navigation fails with no network.
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="text-4xl" aria-hidden>
        📡
      </span>
      <h1 className="text-xl font-bold">You’re offline</h1>
      <p className="max-w-sm text-sm text-muted">
        Speaking practice needs an internet connection — the AI partner, matching, and speech
        recognition all live on the network. Reconnect and try again.
      </p>
    </main>
  );
}
