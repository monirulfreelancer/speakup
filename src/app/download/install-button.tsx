"use client";

import { useEffect, useState } from "react";
import { Check, Download } from "lucide-react";
import {
  canPromptInstall,
  isStandalone,
  onInstallStateChange,
  promptInstall,
} from "@/components/pwa/install-state";
import { Button } from "@/components/ui/button";

/*
 * The real install button, driven by beforeinstallprompt.
 *
 * That event only fires when the browser has decided the app is
 * installable, and never fires at all once installed — so this always
 * offers a manual fallback rather than a button that does nothing.
 */

type State = "checking" | "ready" | "installed" | "unavailable";

export function InstallButton({
  label = "Install app",
  fallbackTitle,
  fallbackSteps,
}: {
  label?: string;
  fallbackTitle: string;
  fallbackSteps: string[];
}) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const decide = () => {
      if (isStandalone()) return setState("installed");
      setState(canPromptInstall() ? "ready" : "unavailable");
    };
    decide();
    return onInstallStateChange(decide);
  }, []);

  if (state === "installed") {
    return (
      <p className="flex items-center justify-center gap-2 rounded-2xl border-2 border-line bg-surface p-4 text-sm font-bold">
        <Check className="size-5 text-success" aria-hidden />
        SpeakUp is already installed on this device.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {state === "ready" && (
        <Button
          size="lg"
          fullWidth
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const outcome = await promptInstall();
            setBusy(false);
            if (outcome === "accepted") setState("installed");
          }}
        >
          <Download className="size-5" aria-hidden />
          {label}
        </Button>
      )}

      {state !== "ready" && (
        <div className="space-y-2 rounded-2xl border-2 border-line bg-surface p-5">
          <h2 className="text-lg">{fallbackTitle}</h2>
          <ol className="list-inside list-decimal space-y-1 text-sm text-muted">
            {fallbackSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
