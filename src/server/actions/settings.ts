"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { INTEREST_VALUES, MAX_BIO_LENGTH, MAX_INTERESTS } from "@/lib/interests";

/*
 * Settings mutations. Each action re-authenticates, zod-validates its input,
 * and returns { ok } / { error } so client components can roll back
 * optimistic state on failure.
 */

export type SettingsResult = { ok: true } | { ok: false; error: string };

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

const enforcementSchema = z.enum(["GENTLE", "STRICT", "AUTO"]);

export async function updateEnforcementMode(mode: string): Promise<SettingsResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const parsed = enforcementSchema.safeParse(mode);
  if (!parsed.success) return { ok: false, error: "Unknown mode" };

  await db.user.update({ where: { id: userId }, data: { enforcementMode: parsed.data } });
  revalidatePath("/settings");
  return { ok: true };
}

const uiLanguageSchema = z.enum(["en"]); // more locales later

export async function updateUiLanguage(language: string): Promise<SettingsResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const parsed = uiLanguageSchema.safeParse(language);
  if (!parsed.success) return { ok: false, error: "Unsupported language" };

  await db.userSettings.update({
    where: { userId },
    data: { uiLanguage: parsed.data },
  });
  revalidatePath("/settings");
  return { ok: true };
}

const ttsSchema = z.object({
  voice: z.string().max(200).nullable(),
  rate: z.number().min(0.5).max(2),
});

export async function updateTts(input: { voice: string | null; rate: number }): Promise<SettingsResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const parsed = ttsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid voice settings" };

  await db.userSettings.update({
    where: { userId },
    data: { ttsVoice: parsed.data.voice, ttsRate: parsed.data.rate },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateNotifications(enabled: boolean): Promise<SettingsResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const parsed = z.boolean().safeParse(enabled);
  if (!parsed.success) return { ok: false, error: "Invalid value" };

  await db.userSettings.update({
    where: { userId },
    data: { notificationsEnabled: parsed.data },
  });
  revalidatePath("/settings");
  return { ok: true };
}

/*
 * Directory profile: display name, bio and interests. Everything is trimmed
 * and hard-capped server-side — the client counter is a convenience, not a
 * guarantee.
 */
const profileSchema = z.object({
  name: z.string().trim().min(1, "Please enter a name").max(50, "That name is too long"),
  bio: z.string().trim().max(MAX_BIO_LENGTH, `Keep your bio under ${MAX_BIO_LENGTH} characters`),
  interests: z
    .array(z.enum(INTEREST_VALUES as [string, ...string[]]))
    .max(MAX_INTERESTS, `Pick at most ${MAX_INTERESTS} interests`),
  cefrLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
});

/** Field-level errors so the form can show each message in place. */
export type ProfileSaveResult =
  | { ok: true }
  | { ok: false; error: string; field?: "name" | "bio" | "interests" | "cefrLevel" };

export async function updateProfile(input: {
  name: string;
  bio: string;
  interests: string[];
  cefrLevel: string;
}): Promise<ProfileSaveResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return {
      ok: false,
      error: issue?.message ?? "That profile is not valid",
      field:
        field === "name" || field === "bio" || field === "interests" || field === "cefrLevel"
          ? field
          : undefined,
    };
  }

  await db.user.update({
    where: { id: userId },
    data: {
      name: parsed.data.name,
      bio: parsed.data.bio || null,
      cefrLevel: parsed.data.cefrLevel,
      // Deduplicate: the UI cannot produce repeats, but a crafted request can.
      interests: [...new Set(parsed.data.interests)],
    },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard");
  return { ok: true };
}
