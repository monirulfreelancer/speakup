"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { usePresence } from "@/lib/realtime/use-presence";
import { interestLabel } from "@/lib/interests";
import { lastSeenLabel } from "@/lib/relative-time";
import { LevelBadge } from "@/components/level-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadMorePeople } from "@/server/actions/people";
import type { CefrLevel } from "@/generated/prisma/enums";

/*
 * The people directory. The first page is server-rendered (so it indexes as
 * real content and appears instantly); "Load more" and the live green dots
 * are the only client-side work.
 *
 * Search and level filtering navigate, so the SERVER re-queries. Filtering
 * the already-loaded page in the browser would silently search only the
 * first 30 people.
 */

export type Person = {
  id: string;
  name: string;
  cefrLevel: CefrLevel | null;
  bio: string | null;
  interests: string[];
  lastSeenAt: Date | string | null;
};

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export function PeopleDirectory({
  initialPeople,
  initialHasMore,
  total,
  search,
  level,
}: {
  initialPeople: Person[];
  initialHasMore: boolean;
  total: number;
  search: string;
  level: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { online } = usePresence();

  const [people, setPeople] = useState(initialPeople);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState(search);
  const [pending, startTransition] = useTransition();

  // NOTE: a filter change remounts this component (the parent keys it on
  // the active filters), so paging state resets without syncing props to
  // state in an effect.

  // Debounced search: navigate so the server re-queries.
  useEffect(() => {
    if (query === search) return;
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query.trim()) next.set("q", query.trim());
      else next.delete("q");
      router.replace(`/people?${next.toString()}`);
    }, 350);
    return () => clearTimeout(id);
  }, [query, search, params, router]);

  function setLevel(nextLevel: string) {
    const next = new URLSearchParams(params.toString());
    if (nextLevel) next.set("level", nextLevel);
    else next.delete("level");
    router.replace(`/people?${next.toString()}`);
  }

  function loadMore() {
    startTransition(async () => {
      const result = await loadMorePeople({ search, level, page: page + 1 }).catch(() => null);
      if (!result) return;
      setPeople((prev) => [...prev, ...result.people]);
      setHasMore(result.hasMore);
      setPage((p) => p + 1);
    });
  }

  // Online first, then most recently seen. Presence is client-only knowledge,
  // so this ordering cannot happen on the server.
  const sorted = useMemo(() => {
    return [...people].sort((a, b) => {
      const aOnline = online.has(a.id) ? 1 : 0;
      const bOnline = online.has(b.id) ? 1 : 0;
      if (aOnline !== bOnline) return bOnline - aOnline;
      const aSeen = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
      const bSeen = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
      return bSeen - aSeen;
    });
  }, [people, online]);

  const filtersActive = Boolean(search || level);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold">People</h1>
        <p className="text-sm text-muted-foreground">
          Find someone to practise with. {total} {total === 1 ? "learner" : "learners"} here.
        </p>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name"
        aria-label="Search people by name"
        className="h-11"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setLevel("")}
          className={`min-h-9 rounded-full border px-4 text-sm ${
            !level ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
          }`}
        >
          All
        </button>
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLevel(l)}
            className={`min-h-9 rounded-full border px-4 font-mono text-sm ${
              level === l ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {filtersActive
              ? "Nobody matches those filters yet. SpeakUp is still small, so try a wider search."
              : "No other learners have joined yet. Check back soon, or practise with the AI partner in the meantime."}
          </p>
          {filtersActive && (
            <Button variant="outline" className="h-11" onClick={() => router.replace("/people")}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((person) => {
            const isOnline = online.has(person.id);
            return (
              <li key={person.id}>
                <Link
                  href={`/people/${person.id}`}
                  className="flex min-h-16 items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-accent"
                >
                  <div className="relative shrink-0">
                    <div className="flex size-12 items-center justify-center rounded-full bg-accent text-lg font-bold">
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                    {isOnline && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-background bg-green-500"
                        aria-label="Online now"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{person.name}</span>
                      {person.cefrLevel && <LevelBadge level={person.cefrLevel} />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isOnline ? (
                        <span className="text-green-600 dark:text-green-400">Online now</span>
                      ) : (
                        lastSeenLabel(person.lastSeenAt ? new Date(person.lastSeenAt) : null)
                      )}
                    </p>
                    {person.bio && (
                      <p className="truncate text-sm text-muted-foreground">{person.bio}</p>
                    )}
                    {person.interests.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {person.interests.slice(0, 3).map((interest) => (
                          <span
                            key={interest}
                            className="rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {interestLabel(interest)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <Button variant="outline" className="h-11 w-full" onClick={loadMore} disabled={pending}>
          {pending ? "Loading…" : "Load more"}
        </Button>
      )}
    </main>
  );
}
