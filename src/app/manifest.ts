import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/*
 * Web app manifest (served at /manifest.webmanifest). TWA-ready: standalone
 * display, portrait, maskable icons with safe-area padding, and
 * shortcuts — the same manifest a Bubblewrap/PWABuilder Android wrap reads.
 */

/*
 * Rendered per request, not at build time: the AI shortcut depends on
 * AI_MODE_ENABLED, and a prerendered manifest would freeze whatever the
 * flag happened to be during the build.
 */
export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SpeakUp — English Speaking Practice",
    short_name: "SpeakUp",
    description: "Practice speaking English with an AI partner — or a real person.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Literal on purpose: a manifest cannot read CSS variables. Keep in step
    // with --background / --surface in globals.css.
    theme_color: "#f7f9fc",
    background_color: "#f7f9fc",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Separate files, not the same art reused: a maskable icon is drawn
      // with padding so Android can crop it to any shape without clipping.
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      // The AI shortcut would deep-link into a redirect while the flag is off.
      ...(env.AI_MODE_ENABLED
        ? [
            {
              name: "Talk with AI",
              url: "/practice/ai",
              icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
            },
          ]
        : []),
      {
        name: "Find a Partner",
        url: "/",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
