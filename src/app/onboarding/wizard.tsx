"use client";

import { useMemo, useState, useTransition } from "react";
import { completeOnboarding } from "@/server/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/*
 * 3-step onboarding wizard. All state is client-side; nothing is written
 * until the final step submits via the completeOnboarding server action
 * (which re-validates everything, including the age gate).
 */

const COMMON_LANGUAGES = [
  "Bengali",
  "Hindi",
  "Urdu",
  "Arabic",
  "Spanish",
  "Portuguese",
  "French",
  "German",
  "Turkish",
  "Russian",
  "Chinese (Mandarin)",
  "Japanese",
  "Korean",
  "Vietnamese",
  "Indonesian",
  "Thai",
  "Tamil",
  "Telugu",
  "Marathi",
  "Punjabi",
  "Persian (Farsi)",
  "Swahili",
  "Italian",
  "Polish",
  "Ukrainian",
  "Dutch",
  "Tagalog (Filipino)",
  "Malay",
  "Burmese",
  "Nepali",
];

const LEVELS: { code: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; label: string; blurb: string }[] = [
  {
    code: "A1",
    label: "Beginner",
    blurb: "I know some words and simple phrases, like introducing myself.",
  },
  {
    code: "A2",
    label: "Elementary",
    blurb: "I can handle everyday basics — shopping, directions, simple questions.",
  },
  {
    code: "B1",
    label: "Intermediate",
    blurb: "I can hold a conversation about familiar topics, with some mistakes.",
  },
  {
    code: "B2",
    label: "Upper intermediate",
    blurb: "I can discuss most topics comfortably and explain my opinions.",
  },
  {
    code: "C1",
    label: "Advanced",
    blurb: "I speak fluently on almost anything, with only occasional slips.",
  },
  {
    code: "C2",
    label: "Mastery",
    blurb: "I speak effortlessly, close to a native speaker.",
  },
];

export function OnboardingWizard({ firstName }: { firstName: string }) {
  const [step, setStep] = useState(1);
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [languageQuery, setLanguageQuery] = useState("");
  const [cefrLevel, setCefrLevel] = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredLanguages = useMemo(() => {
    const q = languageQuery.trim().toLowerCase();
    if (!q) return COMMON_LANGUAGES;
    return COMMON_LANGUAGES.filter((l) => l.toLowerCase().includes(q));
  }, [languageQuery]);

  // Client-side age preview so the under-13 message appears immediately; the
  // server action enforces the same rule authoritatively.
  const age = useMemo(() => {
    if (!dateOfBirth) return null;
    const dob = new Date(`${dateOfBirth}T00:00:00Z`);
    if (Number.isNaN(dob.getTime())) return null;
    const now = new Date();
    let a = now.getUTCFullYear() - dob.getUTCFullYear();
    if (
      now.getUTCMonth() < dob.getUTCMonth() ||
      (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate())
    )
      a -= 1;
    return a;
  }, [dateOfBirth]);

  const underage = age !== null && age >= 0 && age < 13;

  function finish() {
    if (!cefrLevel || underage) return;
    setError(null);
    startTransition(async () => {
      const result = await completeOnboarding({
        nativeLanguage,
        cefrLevel,
        dateOfBirth,
        consent,
      });
      // On success the action redirects; reaching here means it returned an error.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Step {step} of 3</p>
        <h1 className="text-2xl font-bold">
          {step === 1 && `Hi ${firstName}! What's your native language?`}
          {step === 2 && "How good is your English right now?"}
          {step === 3 && "Almost done"}
        </h1>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <Input
            placeholder="Search languages…"
            value={languageQuery}
            onChange={(e) => setLanguageQuery(e.target.value)}
            aria-label="Search languages"
          />
          <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto">
            {filteredLanguages.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setNativeLanguage(lang)}
                className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  nativeLanguage === lang
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                }`}
              >
                {lang}
              </button>
            ))}
            {filteredLanguages.length === 0 && (
              <button
                type="button"
                onClick={() => setNativeLanguage(languageQuery.trim())}
                className="col-span-2 min-h-11 rounded-lg border px-3 py-2 text-left text-sm hover:bg-accent"
              >
                Use “{languageQuery.trim()}”
              </button>
            )}
          </div>
          <Button
            className="h-11 w-full"
            disabled={!nativeLanguage}
            onClick={() => setStep(2)}
          >
            {nativeLanguage ? `Continue with ${nativeLanguage}` : "Continue"}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid gap-2">
            {LEVELS.map((level) => (
              <Card
                key={level.code}
                onClick={() => setCefrLevel(level.code)}
                className={`cursor-pointer py-3 transition-colors ${
                  cefrLevel === level.code ? "border-primary bg-accent" : "hover:bg-accent/50"
                }`}
              >
                <CardContent className="flex items-baseline gap-3 px-4">
                  <span className="w-8 shrink-0 font-mono text-lg font-bold">{level.code}</span>
                  <span>
                    <span className="font-medium">{level.label}.</span>{" "}
                    <span className="text-sm text-muted-foreground">{level.blurb}</span>
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Not sure? Most learners who can already chat a little pick <strong>B1</strong> — you
            can change it any time in settings.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="h-11" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button className="h-11 flex-1" disabled={!cefrLevel} onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dob">Date of birth</Label>
            <Input
              id="dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
            {underage && (
              <p className="text-sm text-destructive">
                SpeakUp is for people aged 13 and over. We can’t create an account for you yet —
                we’re sorry!
              </p>
            )}
          </div>
          <label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              checked={consent}
              onCheckedChange={(v) => setConsent(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm">
              I agree that my speech is processed to power the practice features. Your browser’s
              speech recognition may send audio to its provider (e.g. Google, for Chrome).
            </span>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="h-11" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              className="h-11 flex-1"
              disabled={!dateOfBirth || underage || !consent || pending}
              onClick={finish}
            >
              {pending ? "Setting up…" : "Start practicing"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
