"use client";

import type { SpeechCapabilities } from "@/lib/speech/capabilities";

/*
 * Shown when getSpeechCapabilities() says voice practice can't work here.
 * The reason string already carries the specific fix (https, open in
 * Safari, switch browser); this adds the general browser list.
 */

export function UnsupportedBrowserNotice({ capabilities }: { capabilities: SpeechCapabilities }) {
  return (
    <div className="mx-auto max-w-sm space-y-3 rounded-xl border p-6 text-center">
      <span className="text-3xl" aria-hidden>
        😕
      </span>
      <h2 className="font-semibold">Voice practice isn’t available here</h2>
      <p className="text-sm text-muted">{capabilities.reason}</p>
      <div className="rounded-lg bg-surface-raised p-3 text-left text-sm">
        <p className="mb-1 font-medium">Browsers that work:</p>
        <ul className="list-inside list-disc text-muted">
          <li>Chrome on desktop or Android</li>
          <li>Microsoft Edge</li>
          <li>Safari on iPhone/iPad (iOS 16.4+ for the installed app)</li>
        </ul>
      </div>
    </div>
  );
}
