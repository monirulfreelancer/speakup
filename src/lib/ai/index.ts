import "server-only";
import type { ChatProvider } from "./types";
import { AnthropicChatProvider } from "./anthropic";
import { OpenAIChatProvider } from "./openai";

/*
 * Provider selection. AI_PROVIDER is "anthropic" (default) or "openai".
 * hasProviderKey() lets the route fail with a clear 503 instead of a
 * confusing SDK auth error when the key isn't configured yet.
 */

const PROVIDER = process.env.AI_PROVIDER === "openai" ? "openai" : "anthropic";

let provider: ChatProvider | null = null;

export function getChatProvider(): ChatProvider {
  if (!provider) {
    provider = PROVIDER === "openai" ? new OpenAIChatProvider() : new AnthropicChatProvider();
  }
  return provider;
}

export function getProviderName(): "anthropic" | "openai" {
  return PROVIDER;
}

export function hasProviderKey(): boolean {
  return PROVIDER === "openai"
    ? Boolean(process.env.OPENAI_API_KEY)
    : Boolean(process.env.ANTHROPIC_API_KEY);
}

export { extractMeta, META_PATTERN } from "./types";
export type { ChatMessage, ChatProvider, ReplyMeta } from "./types";
