"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/*
 * Light / Dark / System. next-themes persists the choice; "system" hands
 * control back to the phone.
 *
 * Rendered only after mount: before hydration the resolved theme is
 * unknown, and guessing would flash the wrong option as selected.
 */

const OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/* Server snapshot is false, client is true: the standard mounted check
   without a setState-in-effect. */
const subscribe = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-2">
      {OPTIONS.map((option) => {
        const selected = mounted && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(option.value)}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 text-sm font-bold transition-colors ${
              selected
                ? "border-primary bg-primary text-on-primary"
                : "border-line bg-surface text-muted hover:bg-surface-raised"
            }`}
          >
            <option.icon className="size-5" aria-hidden />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
