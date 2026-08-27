"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/*
 * Completes the onboarding wizard in one write: profile fields, the
 * SPEECH_PROCESSING consent row, and onboardedAt.
 *
 * The age gate lives HERE, server-side — the client wizard shows the same
 * message earlier for a friendlier experience, but the client check is
 * cosmetic and this one is the real one.
 */

// Bump when the consent wording changes; Phase 14 re-prompts on version drift.
const SPEECH_CONSENT_VERSION = "1.0";

const MIN_AGE = 13;
const ADULT_AGE = 18;

export type OnboardingState = { error?: string };

const onboardingSchema = z.object({
  nativeLanguage: z.string().trim().min(1).max(60),
  cefrLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  dateOfBirth: z.iso.date(), // "YYYY-MM-DD" from <input type="date">
  consent: z.literal(true, {
    error: "You need to agree to speech processing to practice speaking",
  }),
});

function ageOn(date: Date, dob: Date): number {
  let age = date.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    date.getUTCMonth() < dob.getUTCMonth() ||
    (date.getUTCMonth() === dob.getUTCMonth() && date.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export async function completeOnboarding(input: {
  nativeLanguage: string;
  cefrLevel: string;
  dateOfBirth: string;
  consent: boolean;
}): Promise<OnboardingState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your answers" };
  }

  const dob = new Date(`${parsed.data.dateOfBirth}T00:00:00Z`);
  const age = ageOn(new Date(), dob);

  if (age < 0 || age > 120) {
    return { error: "That date of birth doesn't look right — please check it" };
  }
  if (age < MIN_AGE) {
    return {
      error:
        "SpeakUp is for people aged 13 and over. We can't create an account for you yet — we're sorry!",
    };
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.user.id },
      data: {
        nativeLanguage: parsed.data.nativeLanguage,
        cefrLevel: parsed.data.cefrLevel,
        dateOfBirth: dob,
        isAdult: age >= ADULT_AGE,
        onboardedAt: new Date(),
      },
    });
    await tx.consent.create({
      data: {
        userId: session.user.id,
        type: "SPEECH_PROCESSING",
        version: SPEECH_CONSENT_VERSION,
      },
    });
  });

  redirect("/dashboard");
}
