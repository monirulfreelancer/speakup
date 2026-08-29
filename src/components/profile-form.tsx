"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/server/actions/settings";
import { INTERESTS, MAX_BIO_LENGTH, MAX_INTERESTS } from "@/lib/interests";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/*
 * The whole editable profile in one form: photo, name, level, bio and
 * interests. Everything other learners see is here, so there is one place
 * to change it rather than four scattered controls.
 *
 * The photo is a separate round trip (multipart upload) but lives in the
 * same section, because to the user it is one thing.
 */

const LEVELS = [
  { value: "A1", note: "Just starting" },
  { value: "A2", note: "Simple everyday talk" },
  { value: "B1", note: "Comfortable conversations" },
  { value: "B2", note: "Confident and detailed" },
  { value: "C1", note: "Fluent and nuanced" },
  { value: "C2", note: "Near-native" },
] as const;

type Field = "name" | "bio" | "interests" | "cefrLevel";

export function ProfileForm({
  userId,
  initialName,
  initialBio,
  initialInterests,
  initialLevel,
  initialAvatarUpdatedAt,
}: {
  userId: string;
  initialName: string;
  initialBio: string;
  initialInterests: string[];
  initialLevel: string;
  initialAvatarUpdatedAt: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [interests, setInterests] = useState<string[]>(initialInterests);
  const [level, setLevel] = useState(initialLevel);
  const [avatarVersion, setAvatarVersion] = useState(initialAvatarUpdatedAt);

  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<Field | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const atLimit = interests.length >= MAX_INTERESTS;

  function dirty() {
    setSaved(false);
    setError(null);
    setErrorField(null);
  }

  function pickFile(file: File | null) {
    setPhotoError(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoError("Please choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("That photo is larger than 5 MB. Please choose a smaller one.");
      return;
    }
    setPendingFile(file);
    // Local preview so the choice is visible before it is uploaded.
    setPreview(URL.createObjectURL(file));
  }

  async function uploadPhoto() {
    if (!pendingFile) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const body = new FormData();
      body.append("file", pendingFile);
      const response = await fetch("/api/avatar", { method: "POST", body });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        version?: number;
      };
      if (!response.ok) {
        setPhotoError(data.error ?? "That photo could not be saved. Try another one.");
        return;
      }
      setAvatarVersion(new Date(data.version ?? Date.now()).toISOString());
      setPendingFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setPhotoError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const response = await fetch("/api/avatar", { method: "DELETE" });
      if (!response.ok) {
        setPhotoError("Could not remove the photo. Try again.");
        return;
      }
      setAvatarVersion(null);
      setPendingFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      router.refresh();
    } catch {
      setPhotoError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function save() {
    setError(null);
    setErrorField(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateProfile({ name, bio, interests, cefrLevel: level }).catch(() => ({
        ok: false as const,
        error: "Could not save. Check your connection and try again.",
        field: undefined,
      }));
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error);
        setErrorField(result.field ?? null);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Photo */}
      <div className="space-y-3">
        <Label>Profile photo</Label>
        <div className="flex items-center gap-4">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Your new photo"
              width={80}
              height={80}
              className="size-20 shrink-0 rounded-full object-cover ring-2 ring-primary"
            />
          ) : (
            <Avatar
              user={{ id: userId, displayName: name || "?", avatarUpdatedAt: avatarVersion }}
              size={80}
              priority
            />
          )}

          <div className="space-y-2">
            {/* A plain file input on purpose: accept="image/*" is what makes
                a phone offer both the camera and the gallery. */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:bg-background file:px-4 file:text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {pendingFile && (
                <Button className="h-11" onClick={uploadPhoto} disabled={photoBusy}>
                  {photoBusy ? "Saving…" : "Save photo"}
                </Button>
              )}
              {avatarVersion && !pendingFile && (
                <Button variant="secondary" className="h-11" onClick={removePhoto} disabled={photoBusy}>
                  Remove photo
                </Button>
              )}
            </div>
          </div>
        </div>
        {photoError && <p className="text-sm text-danger">{photoError}</p>}
      </div>

      {/* Name */}
      <div className="space-y-1">
        <Label htmlFor="profile-name">Display name</Label>
        <Input
          id="profile-name"
          value={name}
          maxLength={50}
          onChange={(e) => {
            setName(e.target.value);
            dirty();
          }}
        />
        {errorField === "name" && <p className="text-sm text-danger">{error}</p>}
        <p className="text-xs text-muted">
          This is the only thing other learners see. Your email is never shown.
        </p>
      </div>

      {/* Level */}
      <div className="space-y-2">
        <Label>English level</Label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              title={l.note}
              onClick={() => {
                setLevel(l.value);
                dirty();
              }}
              className={`min-h-11 rounded-lg border font-mono font-bold transition-colors ${
                level === l.value
                  ? "border-primary bg-primary text-on-primary"
                  : "hover:bg-surface-raised"
              }`}
            >
              {l.value}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          This decides who you are matched with in the directory and how simply the AI partner
          speaks to you. Change it whenever it stops fitting.
        </p>
        {errorField === "cefrLevel" && <p className="text-sm text-danger">{error}</p>}
      </div>

      {/* Bio */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="profile-bio">About you</Label>
          <span
            className={`text-xs tabular-nums ${
              bio.length > MAX_BIO_LENGTH ? "text-danger" : "text-muted"
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
            dirty();
          }}
          placeholder="A sentence or two about you and what you want to practise."
          className="min-h-24 w-full rounded-lg border bg-background p-3 text-sm"
        />
        {errorField === "bio" && <p className="text-sm text-danger">{error}</p>}
      </div>

      {/* Interests */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Interests</Label>
          <span className="text-xs text-muted">
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
                onClick={() => {
                  setInterests((prev) =>
                    prev.includes(interest.value)
                      ? prev.filter((i) => i !== interest.value)
                      : prev.length >= MAX_INTERESTS
                        ? prev
                        : [...prev, interest.value],
                  );
                  dirty();
                }}
                disabled={!selected && atLimit}
                aria-pressed={selected}
                className={`min-h-11 rounded-full border px-4 text-sm transition-colors disabled:opacity-40 ${
                  selected ? "border-primary bg-primary text-on-primary" : "hover:bg-surface-raised"
                }`}
              >
                {interest.label}
              </button>
            );
          })}
        </div>
        {atLimit && (
          <p className="text-xs text-muted">
            That is the maximum. Unpick one to choose another.
          </p>
        )}
        {errorField === "interests" && <p className="text-sm text-danger">{error}</p>}
      </div>

      <div className="flex items-center gap-3">
        <Button className="h-11" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
        {saved && <span className="text-sm text-success">Saved</span>}
        {error && !errorField && <span className="text-sm text-danger">{error}</span>}
      </div>
    </div>
  );
}
