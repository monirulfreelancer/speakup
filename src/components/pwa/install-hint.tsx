"use client";

import { useEffect, useState } from "react";
import {
  canPromptInstall,
  isIosSafari,
  isStandalone,
  onInstallStateChange,
  promptInstall,
} from "./install-state";

/*
 * Landing-page install hint. Reuses the shared install state from the PWA
 * work rather than re-detecting anything: native prompt where the browser
 * offers one, Share sheet steps on iOS, and nothing at all on desktop or
 * when already installed.
 */

type Hint = "none" | "android" | "ios";

export function InstallHint() {
  const [hint, setHint] = useState<Hint>("none");

  useEffect(() => {
    const decide = () => {
      if (isStandalone()) return setHint("none");
      if (isIosSafari()) return setHint("ios");
      // Only offer it on touch devices; desktop visitors do not want this.
      const mobile = window.matchMedia("(max-width: 768px)").matches || navigator.maxTouchPoints > 0;
      setHint(mobile && canPromptInstall() ? "android" : "none");
    };
    decide();
    return onInstallStateChange(decide);
  }, []);

  if (hint === "none") return null;

  return (
    <section className="rounded-2xl border border-dashed p-5" aria-labelledby="install-heading">
      <h2 id="install-heading" className="flex items-center gap-2 font-bold">
        <span aria-hidden>📲</span> Keep it on your home screen
      </h2>
      {hint === "ios" ? (
        <p className="pt-1 text-sm text-muted-foreground">
          Tap the Share button in Safari, scroll down, then tap &ldquo;Add to Home Screen&rdquo;.
          SpeakUp opens full screen like a normal app.
        </p>
      ) : (
        <>
          <p className="pt-1 text-sm text-muted-foreground">
            Add SpeakUp to your home screen and it opens with one tap, full screen, no browser bar.
          </p>
          <button
            type="button"
            onClick={() => void promptInstall()}
            className="mt-3 flex h-11 items-center justify-center rounded-lg border px-4 text-sm font-medium hover:bg-accent"
          >
            Add to home screen
          </button>
        </>
      )}
    </section>
  );
}
