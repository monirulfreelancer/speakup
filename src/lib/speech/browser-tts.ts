"use client";

import type { SpeechSynthesisProvider, VoiceOption } from "./types";
import { loadVoices } from "./voices";

/*
 * SpeechSynthesisProvider over window.speechSynthesis.
 *
 * speak() calls are queued and played strictly one at a time, so streaming
 * callers (Phase 4 speaks sentence-by-sentence) can fire-and-forget without
 * utterances talking over each other. cancel() flushes the whole queue.
 */

type QueueItem = {
  text: string;
  voice?: string;
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  resolve: () => void;
};

export class BrowserSpeechSynthesis implements SpeechSynthesisProvider {
  private queue: QueueItem[] = [];
  private playing = false;

  isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  async getVoices(): Promise<VoiceOption[]> {
    const voices = await loadVoices();
    return voices.map((v) => ({ name: v.name, lang: v.lang }));
  }

  speak(
    text: string,
    opts: { voice?: string; rate?: number; onStart?: () => void; onEnd?: () => void } = {},
  ): Promise<void> {
    if (!this.isSupported()) return Promise.resolve();

    return new Promise((resolve) => {
      this.queue.push({ text, ...opts, resolve });
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.playing) return;
    const item = this.queue.shift();
    if (!item) return;
    this.playing = true;

    const utterance = new SpeechSynthesisUtterance(item.text);
    if (item.rate) utterance.rate = item.rate;
    if (item.voice) {
      const match = (await loadVoices()).find((v) => v.name === item.voice);
      if (match) utterance.voice = match;
    }

    const finish = () => {
      item.onEnd?.();
      item.resolve();
      this.playing = false;
      void this.drain();
    };

    utterance.onstart = () => item.onStart?.();
    utterance.onend = finish;
    // An utterance error (canceled, voice missing, interrupted) must not
    // wedge the queue.
    utterance.onerror = finish;

    window.speechSynthesis.speak(utterance);
  }

  cancel(): void {
    // Resolve everything queued so awaiting callers aren't left hanging.
    for (const item of this.queue) item.resolve();
    this.queue = [];
    this.playing = false;
    if (this.isSupported()) window.speechSynthesis.cancel();
  }
}
