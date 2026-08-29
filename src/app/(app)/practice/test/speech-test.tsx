"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getSpeechProvider, getVoiceProvider } from "@/lib/speech";
import type { SpeechError } from "@/lib/speech";
import { getSpeechCapabilities, type SpeechCapabilities } from "@/lib/speech/capabilities";
import { MicButton, type MicState } from "@/components/speech/mic-button";
import { PermissionGate } from "@/components/speech/permission-gate";
import { TranscriptBubble } from "@/components/speech/transcript-bubble";
import { UnsupportedBrowserNotice } from "@/components/speech/unsupported-browser-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FinalLine = { text: string; confidence: number };

// Capabilities are static per page load; cache one snapshot so
// useSyncExternalStore sees a stable reference (server snapshot is null,
// which renders nothing until hydration).
let capabilitiesSnapshot: SpeechCapabilities | null = null;
const getCapabilitiesSnapshot = () => (capabilitiesSnapshot ??= getSpeechCapabilities());

export function SpeechTestSurface() {
  const capabilities = useSyncExternalStore(
    () => () => {},
    getCapabilitiesSnapshot,
    () => null,
  );

  if (!capabilities) return null;
  if (!capabilities.supported) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-4">
        <UnsupportedBrowserNotice capabilities={capabilities} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-bold">Speech test surface</h1>
        <p className="text-sm text-muted">
          Dev-only for Phase 3 — the real conversation arrives in Phase 4.
        </p>
      </div>
      <PermissionGate>{(stream) => <SpeechPanel stream={stream} />}</PermissionGate>
    </main>
  );
}

function SpeechPanel({ stream }: { stream: MediaStream }) {
  const [micState, setMicState] = useState<MicState>("idle");
  const [interim, setInterim] = useState("");
  const [finals, setFinals] = useState<FinalLine[]>([]);
  const [error, setError] = useState<SpeechError | null>(null);
  const [ttsText, setTtsText] = useState("Hello! I am your English practice partner.");

  // Stop recognition and flush TTS when the screen unmounts.
  useEffect(() => {
    const stt = getSpeechProvider();
    const tts = getVoiceProvider();
    return () => {
      stt.abort();
      tts.cancel();
    };
  }, []);

  function toggleMic() {
    const stt = getSpeechProvider();
    if (micState === "listening") {
      stt.stop();
      setMicState("idle");
      setInterim("");
      return;
    }
    setError(null);
    setMicState("listening");
    void stt.start({
      lang: "en-US",
      interimResults: true,
      onInterim: (text) => setInterim(text),
      onFinal: (r) => {
        setInterim("");
        setFinals((prev) => [...prev, r]);
      },
      onError: (e) => {
        setError(e);
        setMicState("idle");
        setInterim("");
      },
    });
  }

  function speak() {
    const tts = getVoiceProvider();
    setMicState("speaking");
    void tts.speak(ttsText, {
      // Functional update: only leave "speaking" if nothing else (e.g. the
      // user tapping the mic) changed the state meanwhile.
      onEnd: () => setMicState((s) => (s === "speaking" ? "idle" : s)),
    });
  }

  return (
    <div className="space-y-6">
      <MicButton state={micState} stream={stream} onClick={toggleMic} />

      {error && (
        <p className="rounded-lg border border-danger p-3 text-sm text-danger">
          {error.code}: {error.message}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted">Transcript</h2>
        <div className="min-h-24 space-y-2 rounded-xl border p-3">
          {finals.length === 0 && !interim && (
            <p className="text-sm text-muted">
              Tap the mic and say something — final lines appear with their confidence score.
            </p>
          )}
          {finals.map((line, i) => (
            <div key={i} className="space-y-1">
              <TranscriptBubble text={line.text} />
              <p className="text-right text-xs text-muted">
                confidence {line.confidence.toFixed(2)}
              </p>
            </div>
          ))}
          {interim && <TranscriptBubble text={interim} interim />}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted">Text to speech</h2>
        <div className="flex gap-2">
          <Input value={ttsText} onChange={(e) => setTtsText(e.target.value)} />
          <Button type="button" className="h-11" onClick={speak}>
            Speak
          </Button>
        </div>
      </section>
    </div>
  );
}
