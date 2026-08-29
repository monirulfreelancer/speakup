"use client";

import { ThemeProvider as NextThemes } from "next-themes";
import type { ReactNode } from "react";

/*
 * Light / Dark / System.
 *
 * next-themes injects a tiny blocking script that sets the class on <html>
 * before first paint, so there is no flash of the wrong theme, and it
 * persists the choice in localStorage. Default is "system", so the app
 * follows the phone until someone chooses otherwise.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
