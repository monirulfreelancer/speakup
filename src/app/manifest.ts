import type { MetadataRoute } from "next";

/*
 * Web app manifest (served at /manifest.webmanifest). TWA-ready: standalone
 * display, portrait, a maskable 512 icon with safe-area padding, and
 * shortcuts — the same manifest a Bubblewrap/PWABuilder Android wrap reads.
 */

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
    theme_color: "#171717",
    background_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-256.png", sizes: "256x256", type: "image/png" },
      { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Talk with AI",
        url: "/practice/ai",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Find a Partner",
        url: "/practice/human",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
