"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/*
 * App shell: bottom tab bar on mobile, left sidebar on desktop. Client
 * component only for the active-tab highlight (usePathname); pages stay
 * server components and render into {children}.
 */

const NAV = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/practice/ai", label: "Practice", icon: "🎙️" },
  { href: "/vocabulary", label: "Vocabulary", icon: "📖" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r md:flex md:flex-col">
        <div className="p-4">
          <Link href="/dashboard" className="text-xl font-bold">
            SpeakUp
          </Link>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium ${
                  active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* pb clears the mobile tab bar */}
      <div className="flex-1 pb-20 md:pb-0">{children}</div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background md:hidden">
        <div className="grid grid-cols-4">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs ${
                  active ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                <span className="text-xl" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
