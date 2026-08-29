"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/server/actions/settings";
import { INTERESTS, MAX_BIO_LENGTH, MAX_INTERESTS } from "@/lib/interests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/*
 * Profile editor: the fields other learners actually see in the directory.
 * Caps are enforced here for feedback and again on the server for real.
 */

export function ProfileForm({
  initialName,
  initialBio,
  initialInterests,
}: {
  initialName: string;
  initialBio: string;
  initialInterests: string[];
}) {
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [interests, setInterests] = useState<string[]>(initialInterests);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const atLimit = interests.length >= MAX_INTERESTS;

  function toggleInterest(value: string) {
    setSaved(false);
    setInterests((prev) =>
      prev.includes(value)
        ? prev.filter((i) => i !== value)
        : prev.length >= MAX_INTERESTS
          ? prev
          : [...prev, value],
    );
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateProfile({ name, bio, interests }).catch(() => ({
        ok: false as const,
        error: "Could not save. Check your connection and try again.",
      }));
      if (result.ok) setSaved(true);
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="profile-name">Display name</Label>
        <Input
          id="profile-name"
          value={name}
          maxLength={50}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
        <p className="text-xs text-muted-foreground">
          This is the only thing other learners see. Your email is never shown.
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="profile-bio">About you</Label>
          <span
            className={`text-xs tabular-nums ${
              bio.length > MAX_BIO_LENGTH ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {bio.length}/{MAX_BIO_LENGTH}
          </span>
        </div>
        <textarea
          id="profile-bio"
          value={bio}
          maxLength={MAX_BIO_LENGTH}
          onChange={(e) => {
            setBio(e.target.value);
            setSaved(false);
          }}
          placeholder="A sentence or two about you and what you want to practise."
          className="min-h-24 w-full rounded-lg border bg-background p-3 text-sm"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Interests</Label>
          <span className="text-xs text-muted-foreground">
            {interests.length}/{MAX_INTERESTS} chosen
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((interest) => {
            const selected = interests.includes(interest.value);
            return (
              <button
                key={interest.value}
                type="button"
                onClick={() => toggleInterest(interest.value)}
                disabled={!selected && atLimit}
                aria-pressed={selected}
                className={`min-h-11 rounded-full border px-4 text-sm transition-colors disabled:opacity-40 ${
                  selected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
                }`}
              >
                {interest.label}
              </button>
            );
          })}
        </div>
        {atLimit && (
          <p className="text-xs text-muted-foreground">
            That is the maximum. Unpick one to choose another.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button className="h-11" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
        {saved && <span className="text-sm text-green-600 dark:text-green-400">Saved</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </div>
  );
}
