"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  canPromptInstall,
  isIosSafari,
  isStandalone,
  onInstallStateChange,
  promptInstall,
} from "./install-state";

/*
 * "Install app" entry for the Settings screen. Reopens the native prompt
 * where one is available, shows the Share → Add to Home Screen steps on
 * iOS, and disappears entirely once running installed.
 */

type State = "hidden" | "native" | "ios" | "unavailable";

export function InstallSettingsEntry() {
  const [state, setState] = useState<State>("hidden");
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    const decide = () => {
      if (isStandalone()) return setState("hidden");
      if (isIosSafari()) return setState("ios");
      setState(canPromptInstall() ? "native" : "unavailable");
    };
    decide();
    return onInstallStateChange(decide);
  }, []);

  if (state === "hidden") return null;

  return (
    <div className="space-y-2">
      <div className="flex min-h-11 items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Install app</p>
          <p className="text-xs text-muted-foreground">One-tap practice from your home screen</p>
        </div>
        <Button
          variant="outline"
          className="h-11"
          onClick={() => {
            if (state === "native") void promptInstall();
            else setShowIosSteps((v) => !v);
          }}
        >
          {state === "ios" ? "How to install" : "Install"}
        </Button>
      </div>
      {state === "ios" && showIosSteps && (
        <ol className="list-inside list-decimal rounded-lg bg-accent p-3 text-sm text-muted-foreground">
          <li>Tap the Share button (the square with an arrow) in Safari</li>
          <li>Scroll down and tap “Add to Home Screen”</li>
          <li>Tap “Add” — SpeakUp appears with your other apps</li>
        </ol>
      )}
      {state === "unavailable" && (
        <p className="text-xs text-muted-foreground">
          Your browser will offer installation once it considers the app ready — or use its menu:
          “Install app” / “Add to Home screen”.
        </p>
      )}
    </div>
  );
}
