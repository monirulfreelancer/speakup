"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/*
 * Acquires microphone permission and hands the resulting MediaStream to its
 * children (render prop). Owns the stream's lifecycle: every track is
 * stopped on unmount, so the browser's mic-in-use indicator never outlives
 * the practice screen.
 *
 * States: prompt (explain + button) → requesting → granted (children) or
 * denied (per-browser recovery instructions).
 */

type GateState = "prompt" | "requesting" | "granted" | "denied";

function recoveryInstructions(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) {
    return "Open Settings → Safari (or your browser) → Microphone and allow access, then reload this page.";
  }
  if (/Android/.test(ua)) {
    return "Tap the padlock (or tune icon) next to the address bar → Permissions → Microphone → Allow, then reload.";
  }
  if (/Firefox/.test(ua)) {
    return "Click the microphone icon in the address bar, remove the block, then reload the page.";
  }
  // Chrome/Edge/Safari desktop
  return "Click the camera/microphone icon at the right of the address bar, set Microphone to Allow, then reload the page.";
}

export function PermissionGate({ children }: { children: (stream: MediaStream) => ReactNode }) {
  const [state, setState] = useState<GateState>("prompt");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const request = useCallback(async () => {
    setState("requesting");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setState("granted");
    } catch {
      setState("denied");
    }
  }, []);

  // If permission was granted before, skip the explainer screen.
  useEffect(() => {
    let cancelled = false;
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((status) => {
        if (cancelled) return;
        if (status.state === "granted") void request();
        else if (status.state === "denied") setState("denied");
      })
      .catch(() => {
        // Permissions API not available (Safari) — stay on the prompt.
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  // The one place mic tracks are released.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  if (state === "granted" && stream) return <>{children(stream)}</>;

  if (state === "denied") {
    return (
      <div className="mx-auto max-w-sm space-y-3 rounded-xl border p-6 text-center">
        <span className="text-3xl" aria-hidden>
          🎙️🚫
        </span>
        <h2 className="font-semibold">Microphone access is blocked</h2>
        <p className="text-sm text-muted-foreground">{recoveryInstructions()}</p>
        <Button variant="outline" className="h-11" onClick={() => window.location.reload()}>
          I’ve allowed it — reload
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-3 rounded-xl border p-6 text-center">
      <span className="text-3xl" aria-hidden>
        🎙️
      </span>
      <h2 className="font-semibold">SpeakUp needs your microphone</h2>
      <p className="text-sm text-muted-foreground">
        Speaking practice means speaking — your browser will ask for microphone access once.
      </p>
      <Button className="h-11 w-full" onClick={request} disabled={state === "requesting"}>
        {state === "requesting" ? "Waiting for permission…" : "Enable microphone"}
      </Button>
    </div>
  );
}
