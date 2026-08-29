"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

/*
 * Bottom sheet on mobile, centred dialog from md up. Used for anything
 * that interrupts: confirmations, the report form, the install nudge.
 *
 * Escape closes it, the background scroll is locked while it is open, and
 * the backdrop is clickable — all the things people expect from a modal
 * and notice only when they are missing.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-scrim"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-t-3xl border-2 border-line bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] duration-200 animate-in slide-in-from-bottom-4 sm:rounded-3xl sm:pb-5"
      >
        {title && (
          <div className="flex items-start justify-between gap-4 pb-3">
            <h2 className="text-lg font-extrabold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-raised"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
