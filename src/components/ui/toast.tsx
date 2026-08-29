"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

/*
 * Minimal toast. Deliberately tiny: one queue, auto-dismiss, no library.
 * Sits above the bottom tab bar so it never covers navigation.
 */

type Tone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: Tone };

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const TONES = {
  success: "border-success text-success",
  error: "border-danger text-danger",
  info: "border-line text-text",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: Tone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone];
          return (
            <div
              key={toast.id}
              className={`flex w-full max-w-sm items-center gap-2 rounded-2xl border-2 bg-surface px-4 py-3 text-sm font-semibold duration-200 animate-in slide-in-from-bottom-2 ${TONES[toast.tone]}`}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="text-text">{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
