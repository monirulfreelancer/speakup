import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, NetworkOnly, Serwist } from "serwist";

/*
 * Service worker (compiled by @serwist/next into public/sw.js; disabled in
 * development).
 *
 * Caching policy:
 * - App shell / build assets: precache + defaultCache (hashed Next assets
 *   are cache-first — immutable by construction).
 * - Pages: network-first with cached fallback (defaultCache), and a
 *   dedicated /offline document when navigation fails entirely.
 * - /api/* (auth included) and the realtime service origin: NETWORK ONLY,
 *   listed FIRST so nothing below can ever match them. A cached API
 *   response here means stale auth or a phantom practice session.
 */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & WorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Order matters: these two guards run before every other rule.
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    {
      // EVERY cross-origin request bypasses the cache — this covers the
      // realtime (Socket.io) service origin without baking its URL into the
      // worker, and everything else the app doesn't own.
      matcher: ({ sameOrigin }) => !sameOrigin,
      handler: new NetworkOnly(),
    },
    {
      // Every same-origin page navigation: network-first, cached fallback.
      //
      // This rule must exist for the /offline fallback to work at all: the
      // fallback plugin only attaches to runtime-caching STRATEGIES, so a
      // navigation with no matching rule bypasses the worker entirely and
      // the browser shows its own error page. Verified by watching exactly
      // that happen without this rule.
      matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === "navigate",
      handler: new NetworkFirst({ cacheName: "pages", networkTimeoutSeconds: 10 }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

// Serwist precaches each fallback entry's URL itself, so /offline is
// available before the first offline navigation.
serwist.addEventListeners();
