"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/*
 * A soft ring that breathes with the speaker's voice, wrapped around the
 * avatar it belongs to. Far kinder to look at than a bar graph, and it
 * makes "connected but silent" instantly obvious.
 *
 * The whole audio graph is created and torn down per stream, so nothing
 * leaks when the call ends or the stream is swapped. Scale is driven
 * directly rather than through React state: sixty state updates a second
 * would re-render the call screen continuously.
 */

export function AudioRing({
  stream,
  children,
  className = "",
}: {
  stream: MediaStream | null;
  children: ReactNode;
  className?: string;
}) {
  const ringRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      if (ringRef.current) {
        ringRef.current.style.transform = "scale(1)";
        ringRef.current.style.opacity = "0";
      }
      return;
    }

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
      const level = Math.min(1, sum / data.length / 110);
      if (ringRef.current) {
        ringRef.current.style.transform = `scale(${1 + level * 0.35})`;
        ringRef.current.style.opacity = `${0.15 + level * 0.7}`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      void audioContext.close();
    };
  }, [stream]);

  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <span
        ref={ringRef}
        aria-hidden
        className="absolute inset-0 rounded-full bg-primary opacity-0 transition-[transform,opacity] duration-75"
      />
      <span className="relative">{children}</span>
    </span>
  );
}
