/*
 * Provider-agnostic chat interface. Anthropic and OpenAI are drivers behind
 * it; adding a provider is one new file implementing ChatProvider.
 */

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export interface ChatProvider {
  /** The exact model id used, stored on the PracticeSession row. */
  readonly model: string;
  streamReply(input: {
    messages: ChatMessage[];
    systemPrompt: string;
    maxTokens: number;
    temperature: number;
  }): AsyncIterable<string>;
}

/** The machine-readable line the model appends to every reply. */
export type ReplyMeta = {
  nonEnglish: boolean;
  difficultyFit: "easy" | "good" | "hard";
};

export const META_PATTERN = /<<meta:(\{.*?\})>>/;

/** Splits a full reply into display text and the parsed meta (if present). */
export function extractMeta(fullText: string): { text: string; meta: ReplyMeta | null } {
  const match = fullText.match(META_PATTERN);
  if (!match) return { text: fullText.trim(), meta: null };

  let meta: ReplyMeta | null = null;
  try {
    const parsed = JSON.parse(match[1]) as Partial<ReplyMeta>;
    meta = {
      nonEnglish: parsed.nonEnglish === true,
      difficultyFit:
        parsed.difficultyFit === "easy" || parsed.difficultyFit === "hard"
          ? parsed.difficultyFit
          : "good",
    };
  } catch {
    // Malformed meta is dropped silently — it's telemetry, not content.
  }
  return { text: fullText.replace(META_PATTERN, "").trim(), meta };
}
