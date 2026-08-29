"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { getSocket } from "@/lib/realtime/socket";
import type { LobbyRoomSummary } from "@/lib/realtime/events";
import { createRoom, joinRoom } from "@/server/actions/rooms";
import { MAX_ROOM_SIZE } from "@/lib/rooms";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CefrLevel } from "@/generated/prisma/enums";

/*
 * Rooms on Home: a secondary feature that must not push the people list —
 * the main thing — below the fold.
 *
 * With no live rooms this renders NOTHING but the "Talk with someone"
 * heading row, whose small "+ Room" button is the always-present entry
 * point. With rooms live, a single sideways-scrolling strip of compact
 * cards appears above that heading.
 *
 * This component owns the heading row because the "+ Room" button shares
 * the create Sheet's state with the strip; splitting them would mean
 * lifting all of this into the page for no gain.
 */

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function RoomLobby({
  initialRooms,
  defaultLevel,
  topics,
}: {
  initialRooms: LobbyRoomSummary[];
  defaultLevel: CefrLevel;
  topics: string[];
}) {
  const router = useRouter();
  const [rooms, setRooms] = useState(initialRooms);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Create form
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState(topics[0] ?? "Free talk");
  const [level, setLevel] = useState<CefrLevel>(defaultLevel);
  const [maxSize, setMaxSize] = useState(MAX_ROOM_SIZE);

  useEffect(() => {
    const socket = getSocket();

    const onRooms = ({ rooms: next }: { rooms: LobbyRoomSummary[] }) => setRooms(next);
    const onChanged = ({ room }: { room: LobbyRoomSummary }) => {
      setRooms((prev) => {
        const without = prev.filter((r) => r.id !== room.id);
        // A room that has emptied or closed drops out of the strip.
        return room.live ? [room, ...without] : without;
      });
    };

    socket.on("lobby:rooms", onRooms);
    socket.on("lobby:changed", onChanged);

    const subscribe = () => socket.emit("lobby:subscribe");
    socket.on("connect", subscribe);
    if (socket.connected) subscribe();
    else socket.connect();

    return () => {
      socket.off("lobby:rooms", onRooms);
      socket.off("lobby:changed", onChanged);
      socket.off("connect", subscribe);
    };
  }, []);

  function submitCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createRoom({ title, topic, level, maxSize }).catch(() => ({
        ok: false as const,
        error: "Could not create the room. Try again.",
      }));
      if (result.ok) {
        setCreating(false);
        router.push(`/rooms/${result.roomId}`);
      } else {
        setError(result.error);
      }
    });
  }

  function join(roomId: string) {
    setError(null);
    startTransition(async () => {
      const result = await joinRoom(roomId).catch(() => ({
        ok: false as const,
        error: "Could not join. Try again.",
      }));
      if (result.ok) router.push(`/rooms/${roomId}`);
      else setError(result.error);
    });
  }

  return (
    <>
      {rooms.length > 0 && (
        <section className="space-y-1.5" aria-label="Open rooms">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">Rooms</p>
          {/*
            Bleeds to the screen edges so cards can scroll off naturally, and
            the fixed card height keeps the strip from resizing as people
            join or leave — the list below never shifts under a reader.
          */}
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            {rooms.map((room) => {
              const full = room.members.length >= room.maxSize;
              return (
                <article
                  key={room.id}
                  className="flex h-20 w-50 shrink-0 snap-start items-center gap-2 rounded-2xl border-2 border-line bg-surface p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-extrabold">{room.title}</span>
                      <Badge level={room.level} size="sm" />
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <div className="flex -space-x-1.5">
                        {room.members.slice(0, 3).map((member) => (
                          <Avatar
                            key={member.userId}
                            user={{
                              id: member.userId,
                              displayName: member.name,
                              avatarUpdatedAt: member.avatarUpdatedAt,
                            }}
                            size={20}
                            className="ring-2 ring-surface"
                          />
                        ))}
                      </div>
                      <span className="flex items-center gap-0.5 text-xs font-bold text-muted">
                        <Users className="size-3" aria-hidden />
                        {room.members.length}/{room.maxSize}
                      </span>
                    </div>
                  </div>

                  {full ? (
                    <span className="shrink-0 rounded-xl bg-surface-raised px-3 py-2 text-xs font-bold text-muted">
                      Full
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => join(room.id)}
                      disabled={pending}
                      className="btn-3d shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-on-primary [--btn-edge:var(--primary-dark)] active:btn-3d-press disabled:opacity-50"
                    >
                      Join
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Always present: the heading row, with the quiet room entry point. */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <h2 className="text-lg">Talk with someone</h2>
        <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden />
          Room
        </Button>
      </div>

      {error && (
        <p className="rounded-2xl border-2 border-danger bg-surface p-3 text-center text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title="Start a room">
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="room-title">Title</Label>
            <Input
              id="room-title"
              value={title}
              maxLength={60}
              placeholder="Morning chat about films"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="room-topic">Topic</Label>
            <input
              id="room-topic"
              list="room-topics"
              value={topic}
              maxLength={80}
              onChange={(e) => setTopic(e.target.value)}
              className="min-h-12 w-full rounded-2xl border-2 border-line bg-surface px-3 text-base font-semibold"
            />
            {/* Existing topics as suggestions, but free text is allowed. */}
            <datalist id="room-topics">
              {topics.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <Label>Level</Label>
            <div className="grid grid-cols-6 gap-1">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  aria-pressed={level === l}
                  className={`min-h-11 rounded-xl border-2 text-sm font-extrabold ${
                    level === l
                      ? "border-primary bg-primary text-on-primary"
                      : "border-line bg-surface text-muted"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Seats</Label>
            <div className="grid grid-cols-4 gap-1">
              {[2, 3, 4, 5].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setMaxSize(size)}
                  aria-pressed={maxSize === size}
                  className={`min-h-11 rounded-xl border-2 text-sm font-extrabold ${
                    maxSize === size
                      ? "border-primary bg-primary text-on-primary"
                      : "border-line bg-surface text-muted"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm font-semibold text-danger">{error}</p>}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button loading={pending} onClick={submitCreate} disabled={!title.trim()}>
              Start
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
