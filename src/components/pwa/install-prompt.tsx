"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  canPromptInstall,
  isIosSafari,
  isStandalone,
  markDismissed,
  onInstallStateChange,
  promptInstall,
  wasDismissed,
} from "./install-state";

/*
 * Dismissible bottom sheet offering installation. Rendered only when the
 * server says the user has completed at least one session (installing on
 * first visit converts terribly), never in standalone mode, and never again
 * after a dismissal.
 */

export function InstallPrompt({ eligible }: { eligible: boolean }) {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (!eligible) return;
    const decide = () => {
      if (isStandalone() || wasDismissed()) return setVisible(false);
      if (isIosSafari()) {
        setIos(true);
        setVisible(true);
      } else {
        setVisible(canPromptInstall());
      }
    };
    decide();
    return onInstallStateChange(decide);
  }, [eligible]);

  if (!visible) return null;

  function dismiss() {
    markDismissed();
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-16 z-50 p-3 md:bottom-0">
      <div className="mx-auto max-w-md space-y-3 rounded-2xl border bg-background p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden>📲</span>
          <div className="flex-1">
            <p className="font-semibold">Add SpeakUp to your home screen</p>
            <p className="text-sm text-muted-foreground">
              {ios
                ? "Tap the Share button, then “Add to Home Screen” — practice opens with one tap."
                : "Install the app for one-tap practice — no browser bar, full screen."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!ios && (
            <Button
              className="h-11 flex-1"
              onClick={async () => {
                const outcome = await promptInstall();
                if (outcome !== "unavailable") setVisible(false);
                if (outcome === "dismissed") markDismissed();
              }}
            >
              Install
            </Button>
          )}
          <Button variant="outline" className="h-11 flex-1" onClick={dismiss}>
            {ios ? "Got it" : "Not now"}
          </Button>
        </div>
      </div>
    </div>
  );
}
