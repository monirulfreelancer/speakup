"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { blockPartner, ratePartner, reportPartner } from "@/server/actions/call";
import { Button } from "@/components/ui/button";

/*
 * Post-call screen: rate the partner, and report or block them if the
 * conversation went badly. Report and block are deliberately one tap away
 * from every call — burying them is how a practice product becomes unsafe.
 */

const REASONS = [
  { value: "NO_ENGLISH", label: "They would not speak English" },
  { value: "INAPPROPRIATE_LANGUAGE", label: "Inappropriate language" },
  { value: "HARASSMENT", label: "Harassment or bullying" },
  { value: "SEXUAL_CONTENT", label: "Sexual content" },
  { value: "SPAM", label: "Spam or advertising" },
  { value: "OTHER", label: "Something else" },
] as const;

export function PostCall({
  matchId,
  partnerName,
  note,
  onDone,
}: {
  matchId: string;
  partnerName: string;
  note: string | null;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [view, setView] = useState<"rate" | "report">("rate");
  const [reason, setReason] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function submitRating(value: number) {
    setRating(value);
    setError(null);
    startTransition(async () => {
      const result = await ratePartner(matchId, value).catch(() => ({
        ok: false as const,
        error: "Could not save your rating.",
      }));
      if (!result.ok) setError(result.error);
    });
  }

  function submitReport() {
    if (!reason) {
      setError("Please choose a reason.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await reportPartner({ matchId, reason, note: detail || undefined }).catch(
        () => ({ ok: false as const, error: "Could not send the report." }),
      );
      if (result.ok) setReported(true);
      else setError(result.error);
    });
  }

  function block() {
    setError(null);
    startTransition(async () => {
      const result = await blockPartner(matchId).catch(() => ({
        ok: false as const,
        error: "Could not block this person.",
      }));
      if (result.ok) setBlocked(true);
      else setError(result.error);
    });
  }

  return (
    <main className="mx-auto max-w-md space-y-6 p-4 md:p-8">
      <div className="space-y-1 text-center">
        <span className="text-4xl" aria-hidden>👋</span>
        <h1 className="text-xl font-bold">Call ended</h1>
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
      </div>

      {view === "rate" ? (
        <>
          <section className="space-y-3 rounded-2xl border p-5 text-center">
            <p className="font-medium">How was your conversation with {partnerName}?</p>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => submitRating(value)}
                  aria-label={`${value} star${value > 1 ? "s" : ""}`}
                  className={`flex size-12 items-center justify-center rounded-lg text-2xl transition-colors hover:bg-accent ${
                    value <= rating ? "opacity-100" : "opacity-30"
                  }`}
                >
                  ⭐
                </button>
              ))}
            </div>
            {rating > 0 && <p className="text-sm text-muted-foreground">Thanks, that helps.</p>}
          </section>

          <section className="space-y-2">
            {blocked ? (
              <p className="rounded-lg bg-accent p-3 text-center text-sm">
                Blocked. You will never be matched with {partnerName} again.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-11" onClick={() => setView("report")}>
                  Report
                </Button>
                <Button variant="outline" className="h-11" onClick={block}>
                  Block
                </Button>
              </div>
            )}
            {reported && (
              <p className="rounded-lg bg-accent p-3 text-center text-sm">
                Report sent. Our moderators will look at it.
              </p>
            )}
          </section>
        </>
      ) : (
        <section className="space-y-3 rounded-2xl border p-5">
          <p className="font-medium">What went wrong?</p>
          <div className="space-y-2">
            {REASONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setReason(option.value)}
                className={`flex min-h-11 w-full items-center rounded-lg border px-3 text-left text-sm ${
                  reason === option.value ? "border-primary bg-accent" : "hover:bg-accent/50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Anything else we should know? (optional)"
            className="min-h-20 w-full rounded-lg border bg-background p-3 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11" onClick={() => setView("rate")}>
              Cancel
            </Button>
            <Button className="h-11" onClick={submitReport} disabled={reported}>
              {reported ? "Sent" : "Send report"}
            </Button>
          </div>
        </section>
      )}

      {error && <p className="text-center text-sm text-destructive">{error}</p>}

      <div className="grid gap-2">
        <Link
          href="/practice/human"
          className="flex h-12 items-center justify-center rounded-lg bg-primary px-6 font-medium text-primary-foreground hover:opacity-90"
        >
          Find another partner
        </Link>
        <Button variant="outline" className="h-11" onClick={onDone}>
          Back to dashboard
        </Button>
      </div>
    </main>
  );
}
