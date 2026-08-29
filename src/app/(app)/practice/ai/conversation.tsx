"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { endAiSession } from "@/server/actions/practice";
import { getSpeechProvider, getVoiceProvider } from "@/lib/speech";
import { SentenceStream } from "@/lib/speech/sentence-stream";
import { MicButton, type MicState } from "@/components/speech/mic-button";
import { TranscriptBubble } from "@/components/speech/transcript-bubble";
import { Button } from "@/components/ui/button";

/*
 * The conversation loop: listen → think → speak → your turn.
 *
 * ECHO PREVENTION IS STRUCTURAL HERE. The recognizer is hard-stopped
 * (abort()) the moment a final transcript arrives — before the API call,
 * long before TTS starts — and it is only ever restarted by an explicit
 * user tap. There is no code path where recognition runs while TTS plays,
 * including barge-in (which cancels TTS first and only then starts
 * listening). Field-tested: relying on echo cancellation instead made the
 * browser transcribe the AI's own voice as user speech.
 */

type Line = { speaker: "user" | "ai"; text: string };

const PROVIDER_ERROR_MARKER = "<<error:provider>>";

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Conversation({
  sessionId,
  topicTitle,
  stream,
}: {
  sessionId: string;
  topicTitle: string | null;
  stream: MediaStream;
}) {
  const router = useRouter();
  const [micState, setMicState] = useState<MicState>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [ending, setEnding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Incremented on every new turn / barge-in so stale async completions
  // can't flip the state machine backwards.
  const turnRef = useRef(0);
  const busyRef = useRef(false);

  // Session timer.
  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll the transcript.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, interim]);

  // Unmount: kill recognition and flush the TTS queue.
  useEffect(() => {
    return () => {
      getSpeechProvider().abort();
      getVoiceProvider().cancel();
    };
  }, []);

  function startListening() {
    const stt = getSpeechProvider();
    setError(null);
    setInterim("");
    setMicState("listening");
    void stt.start({
      lang: "en-US",
      interimResults: true,
      onInterim: (text) => setInterim(text),
      onFinal: (r) => void handleUserTurn(r.text, r.confidence),
      onError: (e) => {
        setMicState("idle");
        setInterim("");
        if (e.code === "no-permission") {
          setError("Microphone access was lost. Allow it in your browser and try again.");
        } else if (e.code === "network") {
          setError("Speech recognition lost its connection. Check your internet and tap the mic to retry.");
        } else if (e.code !== "aborted") {
          setError("Something went wrong with the microphone. Tap to try again.");
        }
      },
    });
  }

  function toggleMic() {
    const stt = getSpeechProvider();
    const tts = getVoiceProvider();

    if (micState === "listening") {
      // Cancel listening without sending.
      stt.abort();
      setMicState("idle");
      setInterim("");
      return;
    }
    if (micState === "speaking") {
      // BARGE-IN: cancel TTS first (recognition is guaranteed stopped), then listen.
      turnRef.current += 1;
      tts.cancel();
      startListening();
      return;
    }
    if (micState === "idle") startListening();
    // "processing": ignore taps.
  }

  async function handleUserTurn(transcript: string, sttConfidence: number) {
    if (busyRef.current || !transcript.trim()) return;
    busyRef.current = true;

    // ECHO PREVENTION: hard-stop the recognizer before anything else.
    getSpeechProvider().abort();

    const turn = (turnRef.current += 1);
    setInterim("");
    setLines((prev) => [...prev, { speaker: "user", text: transcript }]);
    setMicState("processing");
    setError(null);

    try {
      const response = await fetch("/api/practice/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, transcript, sttConfidence }),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}) as Record<string, unknown>);
        setError(friendlyError(data, response.status));
        setMicState("idle");
        return;
      }

      const tts = getVoiceProvider();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const assembler = new SentenceStream();
      const speakPromises: Promise<void>[] = [];
      let raw = "";
      let providerFailed = false;

      setLines((prev) => [...prev, { speaker: "ai", text: "" }]);
      const updateAiLine = (text: string) =>
        setLines((prev) => {
          const next = [...prev];
          next[next.length - 1] = { speaker: "ai", text };
          return next;
        });

      const speak = (sentence: string) => {
        if (turnRef.current !== turn) return; // barged in — stop queueing
        speakPromises.push(
          tts.speak(sentence, {
            onStart: () => {
              if (turnRef.current === turn) {
                setMicState((s) => (s === "processing" ? "speaking" : s));
              }
            },
          }),
        );
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        let chunk = decoder.decode(value, { stream: true });
        raw += chunk;

        const markerAt = raw.indexOf(PROVIDER_ERROR_MARKER);
        if (markerAt !== -1) {
          // Trim the marker (and anything after) out of this chunk.
          const keep = markerAt - (raw.length - chunk.length);
          chunk = keep > 0 ? chunk.slice(0, keep) : "";
          providerFailed = true;
        }

        if (chunk) {
          const { sentences, displayText } = assembler.push(chunk);
          updateAiLine(displayText);
          sentences.forEach(speak);
        }
        if (providerFailed) break;
      }

      const { sentence, displayText } = assembler.flush();
      updateAiLine(displayText);
      if (sentence) speak(sentence);

      if (providerFailed) {
        setError("The AI partner had a problem mid-reply. Tap the mic to continue — the conversation is still here.");
      }

      await Promise.all(speakPromises);
      // Only this turn may return the state to idle ("Your turn").
      if (turnRef.current === turn) {
        setMicState((s) => (s === "speaking" || s === "processing" ? "idle" : s));
      }
    } catch {
      setError("The connection dropped mid-reply. Check your internet and tap the mic to continue.");
      setMicState((s) => (s === "processing" || s === "speaking" ? "idle" : s));
    } finally {
      busyRef.current = false;
    }
  }

  async function endSession() {
    setEnding(true);
    getSpeechProvider().abort();
    getVoiceProvider().cancel();
    await endAiSession(sessionId).catch(() => ({ ok: false }));
    router.push("/dashboard");
  }

  return (
    <main className="mx-auto flex h-[calc(100dvh-5rem)] max-w-2xl flex-col p-4 md:h-dvh md:p-6">
      <header className="flex items-center justify-between pb-3">
        <div>
          <h1 className="font-bold">{topicTitle ?? "Free talk"}</h1>
          <p className="text-sm tabular-nums text-muted">{formatClock(elapsed)}</p>
        </div>
        <Button variant="secondary" className="h-11" onClick={endSession} disabled={ending}>
          {ending ? "Saving…" : "End session"}
        </Button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto rounded-xl border p-3">
        {lines.length === 0 && !interim && (
          <p className="p-4 text-center text-sm text-muted">
            Tap the mic and say hello — your AI partner is listening.
          </p>
        )}
        {lines.map((line, i) => (
          <TranscriptBubble key={i} text={line.text || "…"} speaker={line.speaker} />
        ))}
        {interim && <TranscriptBubble text={interim} interim />}
      </div>

      {error && (
        <p className="mt-2 rounded-lg border border-danger p-2 text-center text-sm text-danger">
          {error}
        </p>
      )}

      <div className="pt-4">
        <MicButton state={micState} stream={stream} onClick={toggleMic} />
      </div>
    </main>
  );
}

function friendlyError(data: Record<string, unknown>, status: number): string {
  const code = typeof data.error === "string" ? data.error : "";
  const message = typeof data.message === "string" ? data.message : "";

  if (code === "rate-limited" || code === "quota-exceeded") {
    const resetAt = typeof data.resetAt === "string" ? new Date(data.resetAt) : null;
    const when =
      resetAt && !Number.isNaN(resetAt.getTime())
        ? ` You can continue at ${resetAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
        : "";
    return `${message}${when}`;
  }
  if (code === "ai-unconfigured") return message;
  if (code === "no-session") return message;
  if (code === "unauthenticated") return "Your login expired — refresh the page and log in again.";
  if (status >= 500) return "The server had a problem. Give it a moment, then tap the mic to retry.";
  return message || "Something went wrong. Tap the mic to try again.";
}
