import OpenAI from "openai";
import type { ChatMessage, ChatProvider } from "./types";

export class OpenAIChatProvider implements ChatProvider {
  readonly model = process.env.AI_MODEL ?? "gpt-4o-mini";
  private client = new OpenAI(); // reads OPENAI_API_KEY

  async *streamReply(input: {
    messages: ChatMessage[];
    systemPrompt: string;
    maxTokens: number;
    temperature: number;
  }): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_completion_tokens: input.maxTokens,
      temperature: input.temperature,
      stream: true,
      messages: [
        { role: "system", content: input.systemPrompt },
        ...input.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}
