"use client";

/*
 * One utterance in the transcript. Interim text (still being recognised)
 * renders muted and italic; final text renders normal. Speaker side flips
 * the bubble, chat-style.
 */

export function TranscriptBubble({
  text,
  interim = false,
  speaker = "user",
}: {
  text: string;
  interim?: boolean;
  speaker?: "user" | "ai" | "partner";
}) {
  const mine = speaker === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
          interim
            ? "border border-dashed text-muted italic"
            : mine
              ? "bg-primary text-on-primary"
              : "bg-surface-raised"
        }`}
      >
        {text}
        {interim && <span className="animate-pulse">…</span>}
      </div>
    </div>
  );
}
