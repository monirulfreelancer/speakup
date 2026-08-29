import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { env } from "@/lib/env";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell aiModeEnabled={env.AI_MODE_ENABLED}>{children}</AppShell>;
}
