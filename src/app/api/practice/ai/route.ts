import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { extractMeta, getChatProvider, getProviderName, hasProviderKey } from "@/lib/ai";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { checkPracticeQuota } from "@/server/quota";

/*
 * The conversation endpoint: user turn in, AI reply streamed out.
 *
 * The response streams RAW model text (including the trailing meta line) as
 * plain text chunks; the client strips the meta before display/TTS and reads
 * its nonEnglish flag. Server-side, the meta is stripped before the AI turn
 * is persisted.
 */

export const dynamic = "force-dynamic";

const CONTEXT_TURNS = 20;

const MAX_TOKENS_BY_LEVEL: Record<string, number> = {
  A1: 120,
  A2: 160,
  B1: 220,
  B2: 300,
  C1: 400,
  C2: 400,
};

const bodySchema = z.object({
  sessionId: z.string().cuid(),
  transcript: z.string().trim().min(1).max(2000),
  sttConfidence: z.number().min(0).max(1).optional(),
});

function friendly(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: code, message, ...extra }, { status });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return friendly(401, "unauthenticated", "Please log in again.");

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return friendly(400, "bad-request", "That request didn't look right.");
  }

  const practiceSession = await db.practiceSession.findFirst({
    where: { id: body.sessionId, userId: session.user.id, status: "ACTIVE", mode: "AI" },
    include: { topic: true, user: { select: { cefrLevel: true, nativeLanguage: true, enforcementMode: true } } },
  });
  if (!practiceSession) {
    return friendly(404, "no-session", "This practice session has ended. Start a new one.");
  }

  const quota = await checkPracticeQuota(session.user.id);
  if (!quota.ok) {
    return friendly(429, quota.reason === "rate" ? "rate-limited" : "quota-exceeded", quota.message, {
      resetAt: quota.resetAt.toISOString(),
    });
  }

  if (!hasProviderKey()) {
    return friendly(
      503,
      "ai-unconfigured",
      "The AI partner isn't set up yet — the server is missing its AI key. Tell the site owner.",
    );
  }

  // Last N turns for context, oldest first.
  const history = (
    await db.sessionTurn.findMany({
      where: { sessionId: practiceSession.id },
      orderBy: { seq: "desc" },
      take: CONTEXT_TURNS,
    })
  ).reverse();

  // Persist the user turn with a server-assigned seq.
  await db.$transaction(async (tx) => {
    const last = await tx.sessionTurn.findFirst({
      where: { sessionId: practiceSession.id },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });
    await tx.sessionTurn.create({
      data: {
        sessionId: practiceSession.id,
        seq: (last?.seq ?? 0) + 1,
        speaker: "USER",
        text: body.transcript,
        sttConfidence: body.sttConfidence,
      },
    });
  });

  const provider = getChatProvider();
  const systemPrompt = buildSystemPrompt({
    level: practiceSession.levelAtSession,
    topicTitle: practiceSession.topic?.title,
    topicSeed: practiceSession.topic?.promptSeed,
    nativeLanguage: practiceSession.user.nativeLanguage,
    enforcementMode: practiceSession.user.enforcementMode,
  });

  const messages = [
    ...history.map((t) => ({
      role: t.speaker === "USER" ? ("user" as const) : ("assistant" as const),
      content: t.text,
    })),
    { role: "user" as const, content: body.transcript },
  ];

  const maxTokens = MAX_TOKENS_BY_LEVEL[practiceSession.levelAtSession] ?? 220;
  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of provider.streamReply({
          messages,
          systemPrompt,
          maxTokens,
          temperature: 0.8,
        })) {
          fullText += chunk;
          controller.enqueue(encoder.encode(chunk));
        }

        // Persist the AI turn (meta stripped) and stamp provider/model once.
        const { text, meta } = extractMeta(fullText);
        await db.$transaction(async (tx) => {
          const last = await tx.sessionTurn.findFirst({
            where: { sessionId: practiceSession.id },
            orderBy: { seq: "desc" },
            select: { seq: true },
          });
          await tx.sessionTurn.create({
            data: {
              sessionId: practiceSession.id,
              seq: (last?.seq ?? 0) + 1,
              speaker: "AI",
              text,
              detectedLanguage: meta?.nonEnglish ? "non-english" : undefined,
            },
          });
          if (!practiceSession.aiProvider) {
            await tx.practiceSession.update({
              where: { id: practiceSession.id },
              data: { aiProvider: getProviderName(), aiModel: provider.model },
            });
          }
        });

        controller.close();
      } catch (error) {
        // Mid-stream failure: surface a marker the client understands, then
        // close. Never leak provider error bodies.
        console.error("AI stream failed:", error instanceof Error ? error.message : error);
        controller.enqueue(encoder.encode("\n<<error:provider>>"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
