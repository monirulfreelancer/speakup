"use client";

import { useState } from "react";
import { ChevronDown, Download } from "lucide-react";

/*
 * The APK, deliberately secondary and collapsed: it is the path that runs
 * into Android's unknown-sources warning, so it should not be what a normal
 * visitor reaches for first.
 *
 * The steps name exactly what Android will say, because the warning is the
 * moment people give up — being told in advance that it is expected is the
 * whole difference.
 */

export function ApkSection({
  version,
  sizeLabel,
  builtAt,
  available,
}: {
  version: string;
  sizeLabel: string;
  builtAt: string;
  available: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!available) return null;

  return (
    <section className="rounded-2xl border-2 border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-5 text-left font-bold"
      >
        Other ways to install
        <ChevronDown
          className={`size-5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="space-y-3 border-t-2 border-line p-5">
          <div>
            <h3 className="font-bold">Android APK</h3>
            <p className="text-xs font-semibold text-muted">
              {version ? `Version ${version} · ` : ""}
              {sizeLabel}
              {builtAt ? ` · built ${builtAt}` : ""}
            </p>
          </div>

          <a
            href="/api/download/apk"
            className="btn-3d flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-line bg-surface px-5 font-bold [--btn-edge:var(--line)] active:btn-3d-press"
          >
            <Download className="size-4" aria-hidden />
            Download the APK
          </a>

          <div className="space-y-2 text-sm text-muted">
            <p>
              Android will warn you about installing an app from outside the Play Store. That is
              normal for any app shared this way, and it is expected here. Here is exactly what to
              tap:
            </p>
            <ol className="list-inside list-decimal space-y-1">
              <li>Tap Download above</li>
              <li>Open the downloaded file</li>
              <li>When Android asks, allow installs from this source</li>
              <li>Tap Install</li>
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
