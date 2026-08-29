"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone, Search, SearchX, UserRound } from "lucide-react";
import { usePresence } from "@/lib/realtime/use-presence";
import { interestLabel } from "@/lib/interests";
import { lastSeenLabel } from "@/lib/relative-time";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { loadMorePeople } from "@/server/actions/people";
import { startCall } from "@/server/actions/call";
import type { CefrLevel } from "@/generated/prisma/enums";

/*
 * The people directory, rendered inline on Home. The first page is
 * server-rendered; "Load more" and the live online dots are the only
 * client-side work.
 *
 * This is the ONLY implementation — Home embeds it rather than linking to a
 * separate page, so there is nothing to keep in sync.
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
  avatarUpdatedAt: Date | string | null;
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
  const [callError, setCallError] = useState<string | null>(null);
  const [callingId, setCallingId] = useState<string | null>(null);

  const levelStripRef = useRef<HTMLDivElement | null>(null);
  const selectedLevelRef = useRef<HTMLButtonElement | null>(null);
  const [levelEdges, setLevelEdges] = useState({ start: true, end: true });

  // NOTE: a filter change remounts this component (the parent keys it on
  // the active filters), so paging state resets without syncing props to
  // state in an effect.

  const updateLevelEdges = useCallback(() => {
    const strip = levelStripRef.current;
    if (!strip) return;
    // 1px of slack: sub-pixel layout means scrollLeft rarely lands exactly
    // on the maximum, which would leave the right fade on forever.
    const end = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1;
    setLevelEdges((prev) => {
      const next = { start: strip.scrollLeft <= 1, end };
      return prev.start === next.start && prev.end === next.end ? prev : next;
    });
  }, []);

  /*
   * Bring the active chip into view on load. Someone filtered to C2 would
   * otherwise open Home with their own filter scrolled off the right edge,
   * see an unexplained short list, and have no idea why.
   *
   * scrollLeft rather than scrollIntoView: the latter also scrolls the
   * nearest scrollable ancestor, which here is the page.
   */
  useEffect(() => {
    const strip = levelStripRef.current;
    const chip = selectedLevelRef.current;
    if (strip && chip) {
      strip.scrollLeft = Math.max(
        0,
        chip.offsetLeft - (strip.clientWidth - chip.clientWidth) / 2,
      );
    }
    updateLevelEdges();
  }, [updateLevelEdges]);

  // Debounced search: navigate so the server re-queries.
  useEffect(() => {
    if (query === search) return;
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query.trim()) next.set("q", query.trim());
      else next.delete("q");
      router.replace(`/dashboard?${next.toString()}`);
    }, 350);
    return () => clearTimeout(id);
  }, [query, search, params, router]);

  function setLevel(nextLevel: string) {
    const next = new URLSearchParams(params.toString());
    if (nextLevel) next.set("level", nextLevel);
    else next.delete("level");
    router.replace(`/dashboard?${next.toString()}`);
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

  function callPerson(personId: string) {
    setCallError(null);
    setCallingId(personId);
    startTransition(async () => {
      const result = await startCall(personId).catch(() => ({
        ok: false as const,
        error: "Could not start the call. Try again.",
      }));
      if (result.ok) router.push(`/practice/call/${result.roomId}`);
      else {
        setCallError(result.error);
        setCallingId(null);
      }
    });
  }

  // Online first, then most recently seen. Presence is client-only
  // knowledge, so this ordering cannot happen on the server.
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

  // With no one to show and no filters applied, the controls would be
  // filtering an empty list — hide them rather than offer a dead search box.
  const showControls = total > 0 || filtersActive;

  return (
    <section className="space-y-4">
      {showControls && (
      /* Compact filter row: search plus a scrollable level strip. */
      <div className="space-y-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name"
            aria-label="Search people by name"
            className="min-h-12 w-full rounded-2xl border-2 border-line bg-surface pl-9 pr-3 text-base font-semibold placeholder:font-normal placeholder:text-muted"
          />
        </div>

        {/*
         * The strip bleeds to the screen edges on phones, where all seven
         * chips do not fit. The fades are the only cue that it scrolls, so
         * they are driven by real scroll position rather than always shown:
         * a fade on an edge you have already reached is a lie.
         */}
        <div className="relative -mx-4 md:mx-0">
          <div
            ref={levelStripRef}
            onScroll={updateLevelEdges}
            className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 md:flex-wrap md:scroll-px-0 md:px-0"
          >
            <button
              type="button"
              ref={!level ? selectedLevelRef : undefined}
              onClick={() => setLevel("")}
              aria-pressed={!level}
              className={`min-h-11 shrink-0 snap-start rounded-full border-2 px-4 text-sm font-bold ${
                !level
                  ? "border-primary bg-primary text-on-primary"
                  : "border-line bg-surface text-muted"
              }`}
            >
              All
            </button>
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                ref={level === l ? selectedLevelRef : undefined}
                onClick={() => setLevel(l)}
                aria-pressed={level === l}
                className={`min-h-11 w-12 shrink-0 snap-start rounded-full border-2 text-sm font-extrabold ${
                  level === l
                    ? "border-primary bg-primary text-on-primary"
                    : "border-line bg-surface text-muted"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <span
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r from-background to-background/0 transition-opacity md:hidden ${
              levelEdges.start ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-background to-background/0 transition-opacity md:hidden ${
              levelEdges.end ? "opacity-0" : "opacity-100"
            }`}
          />
        </div>
      </div>
      )}

      {callError && (
        <p className="rounded-2xl border-2 border-danger bg-surface p-3 text-center text-sm font-semibold text-danger">
          {callError}
        </p>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          icon={filtersActive ? SearchX : UserRound}
          title={filtersActive ? "Nobody matches those filters" : "No other learners yet"}
          description={
            filtersActive
              ? "SpeakUp is still small, so try a wider search."
              : "Check back soon — new people join every week."
          }
          action={
            filtersActive ? (
              <Button variant="secondary" onClick={() => router.replace("/dashboard")}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {sorted.map((person) => {
            const isOnline = online.has(person.id);
            return (
              <li
                key={person.id}
                className="relative rounded-2xl border-2 border-line bg-surface transition-colors hover:bg-surface-raised"
              >
                <Link
                  href={`/people/${person.id}`}
                  className="flex min-h-20 items-center gap-3 p-3 pr-20"
                >
                  <div className="relative shrink-0">
                    <Avatar
                      user={{
                        id: person.id,
                        displayName: person.name,
                        avatarUpdatedAt: person.avatarUpdatedAt,
                      }}
                      size={48}
                    />
                    {isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-surface bg-success" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="truncate font-extrabold">{person.name}</span>
                      {person.cefrLevel && <Badge level={person.cefrLevel} size="sm" />}
                    </div>
                    {/* Text label, never colour alone. */}
                    <p className="text-xs font-semibold">
                      {isOnline ? (
                        <span className="text-success">Online now</span>
                      ) : (
                        <span className="text-muted">
                          {lastSeenLabel(person.lastSeenAt ? new Date(person.lastSeenAt) : null)}
                        </span>
                      )}
                    </p>
                    {person.bio && <p className="truncate text-sm text-muted">{person.bio}</p>}
                    {person.interests.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {person.interests.slice(0, 3).map((interest) => (
                          <Chip key={interest} label={interestLabel(interest)} />
                        ))}
                      </div>
                    )}
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => callPerson(person.id)}
                  disabled={!isOnline || pending}
                  title={isOnline ? `Call ${person.name}` : `${person.name} is offline`}
                  aria-label={isOnline ? `Call ${person.name}` : `${person.name} is offline`}
                  className="btn-3d absolute right-3 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-on-primary [--btn-edge:var(--primary-dark)] active:btn-3d-press disabled:bg-surface-raised disabled:text-muted disabled:shadow-none"
                >
                  <Phone
                    className={`size-5 ${callingId === person.id ? "animate-pulse" : ""}`}
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <Button variant="secondary" fullWidth loading={pending} onClick={loadMore}>
          Load more
        </Button>
      )}
    </section>
  );
}
