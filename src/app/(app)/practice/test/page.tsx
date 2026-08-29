import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { SpeechTestSurface } from "./speech-test";

export const metadata = { title: "Speech test — SpeakUp" };

// Dev-only speech test surface from Phase 3. Not linked in the nav.
/*
 * Rendered per request. Without this, the AI_MODE_ENABLED guard below runs
 * before any dynamic API and Next prerenders the whole page as a build-time
 * redirect — which would bake the flag into the build, exactly what a
 * runtime flag is meant to avoid.
 */
export const dynamic = "force-dynamic";

export default function SpeechTestPage() {
  // Part of the AI practice surface, so it follows the same flag.
  if (!env.AI_MODE_ENABLED) redirect("/dashboard");

  return <SpeechTestSurface />;
}
