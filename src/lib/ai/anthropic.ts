import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, ChatProvider } from "./types";

/*
 * Anthropic driver.
 *
 * - `temperature` is deliberately NOT sent: current Claude models (Opus 5 /
 *   Sonnet 5 family) reject sampling parameters with a 400. The interface
 *   keeps the field for providers that support it (OpenAI does).
 * - `effort: "low"` keeps replies fast — latency is the product in a spoken
 *   conversation, and a short CEFR-matched reply doesn't need deep thinking.
 */

export class AnthropicChatProvider implements ChatProvider {
  readonly model = process.env.AI_MODEL ?? "claude-opus-5";
  private client = new Anthropic(); // reads ANTHROPIC_API_KEY

  async *streamReply(input: {
    messages: ChatMessage[];
    systemPrompt: string;
    maxTokens: number;
    temperature: number;
  }): AsyncIterable<string> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: input.maxTokens,
      system: input.systemPrompt,
      output_config: { effort: "low" },
      messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  }
}
