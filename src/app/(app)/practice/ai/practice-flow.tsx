"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { startAiSession } from "@/server/actions/practice";
import { getSpeechCapabilities, type SpeechCapabilities } from "@/lib/speech/capabilities";
import { PermissionGate } from "@/components/speech/permission-gate";
import { UnsupportedBrowserNotice } from "@/components/speech/unsupported-browser-notice";
import { Conversation } from "./conversation";

/*
 * Two steps: pick a topic → talk. Capabilities and mic permission gate the
 * whole flow, so the conversation screen can assume both.
 */

type Topic = { id: string; title: string; description: string; icon: string };

let capabilitiesSnapshot: SpeechCapabilities | null = null;
const getCapabilitiesSnapshot = () => (capabilitiesSnapshot ??= getSpeechCapabilities());

export function PracticeFlow({ topics, level }: { topics: Topic[]; level: string }) {
  const capabilities = useSyncExternalStore(
    () => () => {},
    getCapabilitiesSnapshot,
    () => null,
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [topicTitle, setTopicTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!capabilities) return null;
  if (!capabilities.supported) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-4">
        <UnsupportedBrowserNotice capabilities={capabilities} />
      </main>
    );
  }

  function pickTopic(topic: Topic | null) {
    setError(null);
    startTransition(async () => {
      const result = await startAiSession(topic?.id ?? null).catch(() => ({
        ok: false as const,
        error: "Couldn't reach the server — check your connection and try again.",
      }));
      if (result.ok) {
        setTopicTitle(topic?.title ?? null);
        setSessionId(result.sessionId);
      } else {
        setError(result.error);
      }
    });
  }

  if (sessionId) {
    return (
      <PermissionGate>
        {(stream) => <Conversation sessionId={sessionId} topicTitle={topicTitle} stream={stream} />}
      </PermissionGate>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold">What shall we talk about?</h1>
        <p className="text-sm text-muted-foreground">
          Topics matched to your level ({level}) — or just talk about anything.
        </p>
      </div>

      {error && <p className="rounded-lg border border-destructive/50 p-3 text-sm text-destructive">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => pickTopic(null)}
          className="flex min-h-24 flex-col justify-between rounded-2xl bg-primary p-4 text-left text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <span className="text-2xl" aria-hidden>💬</span>
          <span>
            <span className="block font-bold">Free talk</span>
            <span className="block text-sm opacity-80">No topic — just a conversation</span>
          </span>
        </button>
        {topics.map((topic) => (
          <button
            key={topic.id}
            type="button"
            disabled={pending}
            onClick={() => pickTopic(topic)}
            className="flex min-h-24 flex-col justify-between rounded-2xl border p-4 text-left transition-colors hover:bg-accent disabled:opacity-50"
          >
            <span className="text-2xl" aria-hidden>{topic.icon}</span>
            <span>
              <span className="block font-bold">{topic.title}</span>
              <span className="block text-sm text-muted-foreground">{topic.description}</span>
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}
