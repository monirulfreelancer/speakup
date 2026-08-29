"use client";

/*
 * Ring tone, generated with the Web Audio API — no audio files to ship,
 * cache or fail to load.
 *
 * Two soft sine tones per ring, then a pause, repeating: close enough to a
 * familiar phone ring to be understood instantly, quiet enough not to be
 * unpleasant on a laptop speaker. Every oscillator is stopped and the
 * context closed on stop(), so nothing keeps running after the call state
 * changes.
 */

const RING_TONE_HZ = 480;
const RING_TONE_HZ_2 = 620;
const RING_MS = 900;
const GAP_MS = 2200;

export class Ringtone {
  private context: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = true;

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    try {
      this.context = new AudioContext();
    } catch {
      return; // No audio available: the visual ringing UI still works.
    }
    this.ring();
    this.timer = setInterval(() => this.ring(), RING_MS + GAP_MS);
  }

  private ring(): void {
    const context = this.context;
    if (!context || this.stopped) return;

    const now = context.currentTime;
    for (const [index, frequency] of [RING_TONE_HZ, RING_TONE_HZ_2].entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      // Fade in and out so it never clicks.
      const start = now + index * 0.02;
      const end = start + RING_MS / 1000;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.06, start + 0.05);
      gain.gain.setValueAtTime(0.06, end - 0.1);
      gain.gain.linearRampToValueAtTime(0, end);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end);
    }
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.context?.close();
    this.context = null;
  }
}
