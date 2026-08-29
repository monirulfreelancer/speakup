"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen, Plus, Users } from "lucide-react";
import { getSocket } from "@/lib/realtime/socket";
import type { LobbyRoomSummary } from "@/lib/realtime/events";
import { createRoom, joinRoom } from "@/server/actions/rooms";
import { MAX_ROOM_SIZE } from "@/lib/rooms";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CefrLevel } from "@/generated/prisma/enums";

/*
 * The room lobby, above the people list on Home.
 *
 * The first list is server-rendered; after that the socket keeps it live,
 * so a room filling up or emptying is visible without a refresh.
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
        // A room that has emptied or closed drops out of the lobby.
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
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg">Rooms</h2>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden />
          Start a room
        </Button>
      </div>

      {error && (
        <p className="rounded-2xl border-2 border-danger bg-surface p-3 text-center text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {rooms.length === 0 ? (
        <EmptyState
          icon={DoorOpen}
          title="No rooms open right now"
          description="Start one and other learners can drop in."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              Start a room
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {rooms.map((room) => {
            const full = room.members.length >= room.maxSize;
            return (
              <li
                key={room.id}
                className="flex items-center gap-3 rounded-2xl border-2 border-line bg-surface p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="truncate font-extrabold">{room.title}</span>
                    <Badge level={room.level} size="sm" />
                  </div>
                  <p className="truncate text-sm text-muted">{room.topic}</p>
                  <div className="flex items-center gap-2 pt-1.5">
                    <div className="flex -space-x-2">
                      {room.members.slice(0, 4).map((member) => (
                        <Avatar
                          key={member.userId}
                          user={{
                            id: member.userId,
                            displayName: member.name,
                            avatarUpdatedAt: member.avatarUpdatedAt,
                          }}
                          size={24}
                          className="ring-2 ring-surface"
                        />
                      ))}
                    </div>
                    <span className="flex items-center gap-1 text-xs font-bold text-muted">
                      <Users className="size-3.5" aria-hidden />
                      {room.members.length}/{room.maxSize}
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant={full ? "secondary" : "primary"}
                  disabled={full || pending}
                  onClick={() => join(room.id)}
                >
                  {full ? "Full" : "Join"}
                </Button>
              </li>
            );
          })}
        </ul>
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
    </section>
  );
}
