import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Download SpeakUp for Android",
  description:
    "Get the SpeakUp Android app as a direct APK download, or add it to your iPhone home screen from Safari.",
  alternates: { canonical: "/download" },
};

// Keep in sync with appVersionName in android/twa-manifest.json.
const APP_VERSION = "0.1.0";

export default function DownloadPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-8 p-4 md:p-8">
      <div className="space-y-3 text-center">
        <span className="text-5xl" aria-hidden>
          🎙️
        </span>
        <h1 className="text-3xl font-bold">Get the SpeakUp app</h1>
        <p className="mx-auto max-w-md text-muted-foreground">
          The same SpeakUp you use in the browser, as an app on your phone. One tap to open, full
          screen, no address bar.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border p-6">
        <h2 className="text-xl font-bold">Android</h2>
        <a
          href="/downloads/speakup.apk"
          download
          className="flex h-12 items-center justify-center rounded-lg bg-primary px-6 font-medium text-primary-foreground hover:opacity-90"
        >
          Install for Android (APK)
        </a>
        <p className="text-center text-xs text-muted-foreground">
          Version {APP_VERSION} · direct download, not from the Play Store
        </p>
        <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
          <li>Tap the button above. Your phone downloads a file called speakup.apk.</li>
          <li>
            Open the downloaded file. If your phone says installs from this source are not
            allowed, tap Settings on that message and switch the permission on. Android asks this
            once for any app that does not come from the Play Store.
          </li>
          <li>Tap Install, then Open. Log in and you are back where you left off.</li>
        </ol>
      </section>

      <section className="space-y-3 rounded-2xl border p-6">
        <h2 className="text-xl font-bold">iPhone and iPad</h2>
        <p className="text-sm text-muted-foreground">
          There is no APK for iPhone. Instead, open SpeakUp in Safari and add it to your home
          screen. It works the same way: tap the Share button, scroll down, tap &ldquo;Add to Home
          Screen&rdquo;, then &ldquo;Add&rdquo;. The same steps are in the app under Settings.
        </p>
      </section>

      <p className="text-center text-sm text-muted-foreground">
        Prefer the browser? Nothing is lost.{" "}
        <Link href="/" className="underline underline-offset-4">
          SpeakUp works fully on the web
        </Link>
        .
      </p>
    </main>
  );
}
