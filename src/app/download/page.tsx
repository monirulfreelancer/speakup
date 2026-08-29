import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { Share, PlusSquare, Smartphone, ShieldCheck } from "lucide-react";
import { env } from "@/lib/env";
import { getApkInfo } from "@/lib/apk";
import { detectPlatform } from "@/lib/platform";
import { InstallButton } from "./install-button";
import { ApkSection } from "./apk-section";

export const metadata: Metadata = {
  title: "Get SpeakUp on your phone",
  description:
    "Install SpeakUp on Android or iPhone in a couple of taps. Direct APK download also available.",
  alternates: { canonical: "/download" },
};

// Platform comes from the request's User-Agent, so this cannot be static.
export const dynamic = "force-dynamic";

export default async function DownloadPage() {
  const [headerList, apk] = await Promise.all([headers(), getApkInfo()]);
  const platform = detectPlatform(headerList.get("user-agent") ?? "");

  const siteUrl = env.NEXTAUTH_URL.replace(/\/$/, "");
  // Rendered server-side so no QR library ships to the browser.
  const qrSvg =
    platform === "desktop"
      ? await QRCode.toString(siteUrl, {
          type: "svg",
          margin: 1,
          color: { dark: "#14202e", light: "#ffffff" },
        })
      : null;

  return (
    <main className="mx-auto w-full max-w-md space-y-8 p-6">
      <header className="space-y-3 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-primary text-on-primary">
          <Smartphone className="size-8" aria-hidden />
        </span>
        <h1 className="text-3xl">Get SpeakUp on your phone</h1>
        <p className="text-muted">
          One tap to open, full screen, no browser bar. It is the same SpeakUp you already use.
        </p>
      </header>

      {/* ONE primary action, chosen for this visitor. */}
      {platform === "android" && (
        <section className="space-y-3">
          <InstallButton
            fallbackTitle="Add it from your browser menu"
            fallbackSteps={[
              "Tap the ⋮ menu at the top right of Chrome",
              "Tap “Add to Home screen”, then “Install”",
            ]}
          />
        </section>
      )}

      {platform === "ios" && (
        <section className="space-y-3 rounded-2xl border-2 border-line bg-surface p-5">
          <h2 className="text-lg">Add to your Home Screen</h2>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xs font-extrabold">
                1
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                Tap the Share button
                <Share className="size-4 text-primary" aria-hidden />
                at the bottom of Safari
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xs font-extrabold">
                2
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                Scroll down and tap
                <PlusSquare className="size-4 text-primary" aria-hidden />
                <span className="font-bold">Add to Home Screen</span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xs font-extrabold">
                3
              </span>
              <span>
                Tap <span className="font-bold">Add</span>. SpeakUp appears with your other apps.
              </span>
            </li>
          </ol>
        </section>
      )}

      {platform === "ios-other-browser" && (
        <section className="space-y-2 rounded-2xl border-2 border-warning bg-surface p-5">
          <h2 className="text-lg">Open this page in Safari</h2>
          <p className="text-sm text-muted">
            On iPhone and iPad, only Safari can add an app to your Home Screen. Copy this address
            and open it in Safari, then follow the three steps there.
          </p>
          <p className="rounded-xl bg-surface-raised p-3 text-center text-sm font-bold break-all">
            {siteUrl}/download
          </p>
        </section>
      )}

      {platform === "desktop" && (
        <section className="space-y-4">
          <div className="space-y-3 rounded-2xl border-2 border-line bg-surface p-5 text-center">
            <h2 className="text-lg">Scan to open it on your phone</h2>
            {qrSvg && (
              <div
                className="mx-auto w-44 overflow-hidden rounded-xl bg-white p-2 [&>svg]:h-auto [&>svg]:w-full"
                aria-label={`QR code linking to ${siteUrl}`}
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            )}
            <p className="text-sm text-muted">
              Point your phone camera at this code, then follow the steps on your phone.
            </p>
          </div>
          <InstallButton
            label="Install on this computer"
            fallbackTitle="Install from your browser"
            fallbackSteps={[
              "Look for the install icon at the right of the address bar",
              "Or open the browser menu and choose “Install SpeakUp”",
            ]}
          />
        </section>
      )}

      {/* Secondary, collapsed. */}
      <ApkSection
        version={apk?.version ?? ""}
        sizeLabel={apk?.sizeLabel ?? ""}
        builtAt={apk ? apk.builtAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : ""}
        available={Boolean(apk)}
      />

      <p className="flex items-start gap-2 text-xs text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-bold text-text">Is this safe?</span> The app is signed with our own
          key and downloaded straight from this site. Installing it does not give SpeakUp access to
          anything beyond the microphone you already grant in the browser.
        </span>
      </p>

      <p className="text-center text-sm text-muted">
        Prefer the browser? Nothing is lost.{" "}
        <Link href="/" className="font-bold text-primary underline underline-offset-4">
          SpeakUp works fully on the web
        </Link>
        .
      </p>
    </main>
  );
}
