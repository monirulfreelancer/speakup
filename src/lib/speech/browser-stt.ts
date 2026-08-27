"use client";

import type { SpeechError, SpeechRecognitionProvider } from "./types";

/*
 * SpeechRecognitionProvider over the Web Speech API.
 *
 * Browser quirks this wrapper absorbs so callers never see them:
 * - Chrome ships it prefixed as webkitSpeechRecognition.
 * - The engine unilaterally ends a continuous session after ~60s, or after a
 *   silence timeout, firing `end` (sometimes preceded by a "no-speech"
 *   error). While the caller still wants to listen, we transparently start a
 *   fresh recognition instance.
 * - Each final result carries a confidence value (0..1); interim results'
 *   confidence is meaningless and ignored.
 * - On Chrome, audio is streamed to Google's servers for recognition — a
 *   privacy fact surfaced in the consent copy, not something code can change.
 */

type NativeRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: NativeRecognitionEvent) => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type NativeRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string; confidence: number };
  }>;
};

function getRecognitionCtor(): (new () => NativeRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => NativeRecognition;
    webkitSpeechRecognition?: new () => NativeRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function mapErrorCode(nativeError: string): SpeechError["code"] {
  switch (nativeError) {
    case "not-allowed":
    case "service-not-allowed":
      return "no-permission";
    case "no-speech":
      return "no-speech";
    case "network":
      return "network";
    case "aborted":
      return "aborted";
    default:
      return "unknown";
  }
}

type StartOptions = Parameters<SpeechRecognitionProvider["start"]>[0];

export class BrowserSpeechRecognition implements SpeechRecognitionProvider {
  private recognition: NativeRecognition | null = null;
  private opts: StartOptions | null = null;
  // True between start() and stop()/abort() — the flag that tells onend
  // whether to auto-restart or let the session die.
  private shouldListen = false;

  isSupported(): boolean {
    return getRecognitionCtor() !== null;
  }

  async start(opts: StartOptions): Promise<void> {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      opts.onError({
        code: "unsupported",
        message: "Speech recognition is not available in this browser.",
      });
      return;
    }

    // A second start() replaces the session cleanly.
    this.abort();

    this.opts = opts;
    this.shouldListen = true;
    this.spawn(Ctor);
  }

  private spawn(Ctor: new () => NativeRecognition): void {
    const opts = this.opts;
    if (!opts) return;

    const recognition = new Ctor();
    recognition.lang = opts.lang;
    recognition.continuous = true;
    recognition.interimResults = opts.interimResults;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alternative = result[0];
        if (result.isFinal) {
          opts.onFinal({
            text: alternative.transcript.trim(),
            // Chrome occasionally reports 0 for perfectly good results;
            // normalise undefined/NaN to 0 and let the caller decide.
            confidence: Number.isFinite(alternative.confidence) ? alternative.confidence : 0,
          });
        } else {
          interim += alternative.transcript;
        }
      }
      if (interim && opts.interimResults) opts.onInterim(interim.trim());
    };

    recognition.onerror = (event) => {
      const code = mapErrorCode(event.error);
      // no-speech and aborted precede an onend we handle; a permission or
      // network failure is terminal and the caller must know.
      if (code === "no-permission" || code === "network") {
        this.shouldListen = false;
        opts.onError({ code, message: event.message ?? event.error });
      } else if (code === "unknown") {
        opts.onError({ code, message: event.message ?? event.error });
      }
    };

    recognition.onend = () => {
      // The engine's silence/duration timeout, not a caller stop() — start a
      // fresh instance so "listening" survives long pauses.
      if (this.shouldListen) {
        this.spawn(Ctor);
      }
    };

    this.recognition = recognition;
    recognition.start();
  }

  stop(): void {
    this.shouldListen = false;
    this.recognition?.stop(); // lets a pending final result flush
    this.recognition = null;
    this.opts = null;
  }

  abort(): void {
    this.shouldListen = false;
    this.recognition?.abort(); // discards pending results
    this.recognition = null;
    this.opts = null;
  }
}
