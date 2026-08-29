"use client";

import { useEffect, useRef } from "react";

/*
 * Vertical audio level meter driven by an AnalyserNode. Used twice on the
 * call screen (local mic and remote stream) so both people can see that
 * audio is actually flowing — the fastest way to tell "connected but silent"
 * apart from "not connected".
 *
 * The whole audio graph is created and torn down per stream, so nothing
 * leaks when the call ends or the stream is swapped.
 */

export function AudioMeter({ stream }: { stream: MediaStream | null }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      if (barRef.current) barRef.current.style.height = "0%";
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
      const level = Math.min(1, sum / data.length / 128);
      if (barRef.current) barRef.current.style.height = `${Math.round(level * 100)}%`;
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
    <div
      className="flex h-20 w-8 items-end overflow-hidden rounded-full bg-accent"
      role="presentation"
    >
      <div ref={barRef} className="w-full rounded-full bg-primary transition-[height] duration-75" />
    </div>
  );
}
