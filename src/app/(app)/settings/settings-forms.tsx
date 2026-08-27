"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  updateCefrLevel,
  updateEnforcementMode,
  updateNotifications,
  updateTts,
  updateUiLanguage,
  type SettingsResult,
} from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/*
 * Client-side settings controls. Each one updates its local state
 * optimistically, fires the server action, and rolls back with a small
 * error message if the action fails.
 */

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export function CefrLevelPicker({ current }: { current: string }) {
  const [level, setLevel] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function pick(next: string) {
    if (next === level) return;
    const previous = level;
    setLevel(next);
    setError(null);
    startTransition(async () => {
      const result = await updateCefrLevel(next).catch(
        (): SettingsResult => ({ ok: false, error: "Network problem — try again" }),
      );
      if (!result.ok) {
        setLevel(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => pick(l)}
            className={`min-h-11 rounded-lg border font-mono font-bold transition-colors ${
              level === l
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-accent"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

const MODES = [
  { value: "GENTLE", label: "Gentle", blurb: "A friendly nudge; the conversation keeps going." },
  { value: "STRICT", label: "Strict", blurb: "The conversation pauses until you switch back to English." },
  { value: "AUTO", label: "Auto", blurb: "Gentle at A1–B1, strict at B2–C2 — follows your level." },
] as const;

export function EnforcementModePicker({ current }: { current: string }) {
  const [mode, setMode] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function pick(next: string) {
    if (next === mode) return;
    const previous = mode;
    setMode(next);
    setError(null);
    startTransition(async () => {
      const result = await updateEnforcementMode(next).catch(
        (): SettingsResult => ({ ok: false, error: "Network problem — try again" }),
      );
      if (!result.ok) {
        setMode(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => pick(m.value)}
            className={`min-h-11 rounded-lg border p-3 text-left transition-colors ${
              mode === m.value ? "border-primary bg-accent" : "hover:bg-accent/50"
            }`}
          >
            <span className="font-medium">{m.label}.</span>{" "}
            <span className="text-sm text-muted-foreground">{m.blurb}</span>
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function UiLanguageSelect({ current }: { current: string }) {
  const [language, setLanguage] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function pick(next: string) {
    if (next === language) return;
    const previous = language;
    setLanguage(next);
    setError(null);
    startTransition(async () => {
      const result = await updateUiLanguage(next).catch(
        (): SettingsResult => ({ ok: false, error: "Network problem — try again" }),
      );
      if (!result.ok) {
        setLanguage(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <Label htmlFor="ui-language">App language</Label>
      <select
        id="ui-language"
        value={language}
        onChange={(e) => pick(e.target.value)}
        className="h-11 rounded-lg border bg-background px-3 text-sm"
      >
        <option value="en">English</option>
      </select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function NotificationsToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(next: boolean) {
    const previous = enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      const result = await updateNotifications(next).catch(
        (): SettingsResult => ({ ok: false, error: "Network problem — try again" }),
      );
      if (!result.ok) {
        setEnabled(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex min-h-11 items-center justify-between gap-4">
        <Label htmlFor="notifications">Practice reminders</Label>
        <Switch id="notifications" checked={enabled} onCheckedChange={toggle} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

type VoiceOption = { name: string; lang: string };

export function TtsControls({
  initialVoice,
  initialRate,
}: {
  initialVoice: string | null;
  initialRate: number;
}) {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voice, setVoice] = useState<string | null>(initialVoice);
  const [rate, setRate] = useState(initialRate);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // The last values the server confirmed, for rollback.
  const saved = useRef({ voice: initialVoice, rate: initialRate });

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    function load() {
      const all = window.speechSynthesis.getVoices();
      // English voices first — this is an English-practice app.
      const english = all.filter((v) => v.lang.toLowerCase().startsWith("en"));
      const list = (english.length > 0 ? english : all).map((v) => ({
        name: v.name,
        lang: v.lang,
      }));
      setVoices(list);
    }

    load(); // some browsers have voices immediately …
    window.speechSynthesis.addEventListener("voiceschanged", load); // … others load async
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  function persist(nextVoice: string | null, nextRate: number) {
    setError(null);
    startTransition(async () => {
      const result = await updateTts({ voice: nextVoice, rate: nextRate }).catch(
        (): SettingsResult => ({ ok: false, error: "Network problem — try again" }),
      );
      if (!result.ok) {
        setVoice(saved.current.voice);
        setRate(saved.current.rate);
        setError(result.error);
      } else {
        saved.current = { voice: nextVoice, rate: nextRate };
      }
    });
  }

  function preview() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("Hello! This is how I will sound.");
    const match = window.speechSynthesis.getVoices().find((v) => v.name === voice);
    if (match) u.voice = match;
    u.rate = rate;
    window.speechSynthesis.speak(u);
  }

  return (
    <div className="space-y-4">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
        <Label htmlFor="tts-voice">Voice</Label>
        <select
          id="tts-voice"
          value={voice ?? ""}
          onChange={(e) => {
            const next = e.target.value || null;
            setVoice(next);
            persist(next, rate);
          }}
          className="h-11 max-w-56 rounded-lg border bg-background px-3 text-sm"
        >
          <option value="">Device default</option>
          {voices.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="tts-rate">Speech speed</Label>
          <span className="text-sm text-muted-foreground">{rate.toFixed(1)}×</span>
        </div>
        <input
          id="tts-rate"
          type="range"
          min={0.5}
          max={1.5}
          step={0.1}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          onPointerUp={() => persist(voice, rate)}
          onKeyUp={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") persist(voice, rate);
          }}
          className="h-11 w-full accent-primary"
        />
      </div>
      <Button type="button" variant="outline" className="h-11" onClick={preview}>
        ▶ Preview voice
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
