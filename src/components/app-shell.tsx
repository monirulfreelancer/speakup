"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Home, Settings as SettingsIcon, Mic } from "lucide-react";
import { Logo } from "@/components/logo";
import type { LucideIcon } from "lucide-react";
import { IncomingCallProvider } from "@/components/call/incoming-call-provider";
import { ToastProvider } from "@/components/ui/toast";

/*
 * Mobile-first shell: a bottom tab bar on phones, a sidebar from md up.
 * Same routes and labels in both — only the layout differs.
 *
 * The tab bar reserves env(safe-area-inset-bottom) so it clears the home
 * indicator on modern iPhones instead of sitting under it.
 */

type NavItem = { href: string; label: string; icon: LucideIcon };

const HOME: NavItem = { href: "/dashboard", label: "Home", icon: Home };
const AI_PRACTICE: NavItem = { href: "/practice/ai", label: "Practice", icon: Mic };
// People lives on Home now, so a separate tab would point at the page the
// user is already on.
const REST: NavItem[] = [{ href: "/settings", label: "Settings", icon: SettingsIcon }];

export function AppShell({
  children,
  aiModeEnabled,
}: {
  children: ReactNode;
  /** From the server layout: NEXT_PUBLIC_ would bake this in at build time. */
  aiModeEnabled: boolean;
}) {
  const pathname = usePathname();
  const nav = aiModeEnabled ? [HOME, AI_PRACTICE, ...REST] : [HOME, ...REST];

  // The call screen is full-bleed: no chrome competing with the call.
  const immersive = pathname.startsWith("/practice/call/");

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <ToastProvider>
      <div className="min-h-dvh md:flex">
        <IncomingCallProvider />

        {!immersive && (
          <aside className="hidden w-60 shrink-0 border-r-2 border-line bg-surface md:flex md:flex-col">
            <Link href="/dashboard" className="flex items-center gap-2 p-5 text-xl font-extrabold">
              <Logo size={36} title={null} />
              SpeakUp
            </Link>
            <nav className="flex flex-col gap-1 p-3">
              {nav.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 font-bold transition-colors ${
                      active
                        ? "bg-primary text-on-primary"
                        : "text-muted hover:bg-surface-raised hover:text-text"
                    }`}
                  >
                    <item.icon className="size-5" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        )}

        <div className={`flex-1 ${immersive ? "" : "pb-24 md:pb-0"}`}>
          {/*
           * Phones hide the sidebar, which left the app with no logo or name
           * anywhere. This is a label, not a header: slim, no actions, and
           * opaque so content scrolls under it cleanly rather than showing
           * through. It sits below the incoming-call overlay (z-[100]), so
           * that stays full-bleed.
           */}
          {!immersive && (
            <div className="sticky top-0 z-30 border-b-2 border-line bg-surface pt-[env(safe-area-inset-top)] md:hidden">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-4 py-2 text-base font-extrabold"
              >
                <Logo size={28} title={null} />
                SpeakUp
              </Link>
            </div>
          )}
          {children}
        </div>

        {!immersive && (
          <nav
            aria-label="Main"
            className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
          >
            <div className={`grid ${nav.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {nav.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                      active ? "text-primary" : "text-muted"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${
                        active ? "bg-level-a-soft" : ""
                      }`}
                    >
                      <item.icon className="size-5" aria-hidden />
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </ToastProvider>
  );
}
