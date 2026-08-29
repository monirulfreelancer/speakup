"use client";

import { useEffect } from "react";

/*
 * Registers the service worker on production builds. @serwist/next does not
 * auto-register when a custom register component isn't used; this keeps
 * registration explicit and dev-free (no sw.js exists in development).
 */

export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failing (old browser, private mode) never breaks the app.
    });
  }, []);
  return null;
}
