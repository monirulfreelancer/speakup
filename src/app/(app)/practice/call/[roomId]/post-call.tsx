"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Clock, Star, Users } from "lucide-react";
import { blockPartner, ratePartner, reportPartner } from "@/server/actions/call";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { StatTile } from "@/components/ui/stat-tile";

/*
 * Post-call: a friendly summary first, the rating second, and the serious
 * actions as quiet text links underneath. Report and Block stay one tap
 * away — burying them is how a practice product becomes unsafe — but they
 * should not be the first thing a thumb lands on after a good chat.
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
  minutes,
  topicTitle,
}: {
  matchId: string;
  partnerName: string;
  note: string | null;
  onDone: () => void;
  minutes?: number;
  topicTitle?: string | null;
}) {
  const [rating, setRating] = useState(0);
  const [reporting, setReporting] = useState(false);
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
      if (result.ok) {
        setReported(true);
        setReporting(false);
      } else setError(result.error);
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
    <main className="mx-auto w-full max-w-md space-y-6 p-6">
      <div className="space-y-2 pt-6 text-center">
        <h1 className="text-2xl">Nice work</h1>
        <p className="text-sm text-muted">
          {note ?? `That is more English practice than yesterday.`}
        </p>
      </div>

      {(minutes !== undefined || topicTitle) && (
        <section className="grid grid-cols-2 gap-3">
          <StatTile
            icon={Clock}
            value={minutes ?? 0}
            label={minutes === 1 ? "minute spoken" : "minutes spoken"}
            tone="primary"
          />
          <StatTile icon={Users} value={topicTitle ? "1" : "1"} label={topicTitle ?? "free talk"} />
        </section>
      )}

      <section className="space-y-3 rounded-2xl border-2 border-line bg-surface p-5 text-center">
        <p className="font-bold">How was your conversation with {partnerName}?</p>
        <div className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => submitRating(value)}
              aria-label={`${value} star${value > 1 ? "s" : ""}`}
              className="flex size-12 items-center justify-center rounded-xl transition-transform hover:bg-surface-raised active:scale-95"
            >
              <Star
                className={`size-7 ${value <= rating ? "fill-warning text-warning" : "text-line"}`}
                aria-hidden
              />
            </button>
          ))}
        </div>
        {rating > 0 && <p className="text-sm font-semibold text-success">Thanks, that helps.</p>}
      </section>

      {blocked && (
        <p className="rounded-2xl bg-surface-raised p-3 text-center text-sm font-semibold">
          Blocked. You will never be matched with {partnerName} again.
        </p>
      )}
      {reported && (
        <p className="rounded-2xl bg-surface-raised p-3 text-center text-sm font-semibold">
          Report sent. Our moderators will look at it.
        </p>
      )}
      {error && <p className="text-center text-sm font-semibold text-danger">{error}</p>}

      <div className="space-y-2">
        <Link
          href="/people"
          className="btn-3d flex min-h-14 items-center justify-center rounded-2xl bg-primary px-6 text-lg font-bold text-on-primary [--btn-edge:var(--primary-dark)] active:btn-3d-press"
        >
          Find someone else
        </Link>
        <Button variant="secondary" fullWidth onClick={onDone}>
          Back to home
        </Button>
      </div>

      {/* Quiet, but never more than one tap away. */}
      {!blocked && (
        <div className="flex justify-center gap-6 pt-2">
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="min-h-11 text-sm font-bold text-muted underline underline-offset-4 hover:text-danger"
          >
            Report
          </button>
          <button
            type="button"
            onClick={block}
            className="min-h-11 text-sm font-bold text-muted underline underline-offset-4 hover:text-danger"
          >
            Block
          </button>
        </div>
      )}

      <Sheet open={reporting} onClose={() => setReporting(false)} title="What went wrong?">
        <div className="space-y-2">
          {REASONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setReason(option.value)}
              className={`flex min-h-12 w-full items-center rounded-2xl border-2 px-4 text-left text-sm font-semibold ${
                reason === option.value
                  ? "border-primary bg-surface-raised"
                  : "border-line hover:bg-surface-raised"
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
          className="mt-3 min-h-20 w-full rounded-2xl border-2 border-line bg-surface p-3 text-sm"
        />
        <div className="grid grid-cols-2 gap-2 pt-3">
          <Button variant="secondary" onClick={() => setReporting(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submitReport}>
            Send report
          </Button>
        </div>
      </Sheet>
    </main>
  );
}
