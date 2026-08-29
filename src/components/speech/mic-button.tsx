"use client";

import { useEffect, useRef } from "react";

/*
 * Push-to-talk button with four visual states and, while listening, a ring
 * that pulses with the actual microphone level (AnalyserNode over the mic
 * stream — the same stream PermissionGate acquired, so no second
 * getUserMedia prompt).
 *
 * The audio graph lives entirely inside this component and is torn down on
 * unmount and whenever the stream goes away: AudioContext closed, animation
 * frame cancelled. The stream itself belongs to PermissionGate.
 */

export type MicState = "idle" | "listening" | "processing" | "speaking";

const STATE_LABEL: Record<MicState, string> = {
  idle: "Tap to talk",
  listening: "Listening…",
  processing: "Thinking…",
  speaking: "Speaking…",
};

export function MicButton({
  state,
  stream,
  onClick,
  disabled = false,
}: {
  state: MicState;
  stream: MediaStream | null;
  onClick: () => void;
  disabled?: boolean;
}) {
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state !== "listening" || !stream) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    let frame = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const level = sum / data.length / 255; // 0..1
      if (ringRef.current) {
        ringRef.current.style.transform = `scale(${1 + level * 0.6})`;
        ringRef.current.style.opacity = `${0.25 + level * 0.6}`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      void audioContext.close();
    };
  }, [state, stream]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex size-28 items-center justify-center">
        {/* Audio-level ring */}
        {state === "listening" && (
          <div
            ref={ringRef}
            aria-hidden
            className="absolute inset-0 rounded-full bg-danger/30 transition-transform duration-75"
          />
        )}
        {/* Processing spinner ring */}
        {state === "processing" && (
          <div
            aria-hidden
            className="absolute inset-0 animate-spin rounded-full border-4 border-primary/20 border-t-primary"
          />
        )}
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={STATE_LABEL[state]}
          className={`relative z-10 flex size-24 items-center justify-center rounded-full text-4xl shadow-lg transition-colors disabled:opacity-50 ${
            state === "listening"
              ? "bg-danger text-white"
              : state === "speaking"
                ? "bg-level-b text-white"
                : "bg-primary text-on-primary"
          }`}
        >
          {state === "listening" ? "⏹" : state === "speaking" ? "🔊" : "🎙️"}
        </button>
      </div>
      <p className="text-sm font-medium text-muted" aria-live="polite">
        {STATE_LABEL[state]}
      </p>
    </div>
  );
}
