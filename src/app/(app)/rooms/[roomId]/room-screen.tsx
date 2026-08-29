"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, LogOut, Mic } from "lucide-react";
import { getSocket } from "@/lib/realtime/socket";
import type { RoomMember } from "@/lib/realtime/events";
import { leaveRoom } from "@/server/actions/rooms";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CefrLevel } from "@/generated/prisma/enums";

/*
 * Group room, part 1: who is here, updating live. No audio — part 2 adds
 * the mesh, and the placeholder below says so rather than showing a mute
 * button that does nothing.
 */

export function RoomScreen({
  roomId,
  title,
  topic,
  level,
  selfUserId,
  initialMembers,
}: {
  roomId: string;
  title: string;
  topic: string;
  level: CefrLevel;
  selfUserId: string;
  initialMembers: RoomMember[];
}) {
  const router = useRouter();
  const [members, setMembers] = useState<RoomMember[]>(initialMembers);
  const [leaving, setLeaving] = useState(false);
  // Guards the leave path so button + pagehide + unmount cannot fire it twice.
  const leftRef = useRef(false);

  /*
   * Leaving is explicit — button, browser back, or the tab closing all call
   * leaveRoom. The same approach as the one-to-one call:abandon: inferring
   * departure from a socket disconnect is what previously closed things
   * during ordinary navigation.
   */
  const departQuietly = useCallback(() => {
    if (leftRef.current) return;
    leftRef.current = true;
    const socket = getSocket();
    if (socket.connected) socket.emit("group:leave", { roomId });
    void leaveRoom(roomId).catch(() => null);
  }, [roomId]);

  useEffect(() => {
    const socket = getSocket();

    const onJoined = ({ members: next }: { roomId: string; members: RoomMember[] }) =>
      setMembers(next);
    const onMemberJoined = ({ member }: { member: RoomMember }) =>
      setMembers((prev) =>
        prev.some((m) => m.userId === member.userId) ? prev : [...prev, member],
      );
    const onMemberLeft = ({ userId }: { userId: string }) =>
      setMembers((prev) => prev.filter((m) => m.userId !== userId));

    socket.on("group:joined", onJoined);
    socket.on("group:member-joined", onMemberJoined);
    socket.on("group:member-left", onMemberLeft);

    const join = () => socket.emit("group:join", { roomId });
    socket.on("connect", join);
    if (socket.connected) join();
    else socket.connect();

    window.addEventListener("pagehide", departQuietly);

    return () => {
      socket.off("group:joined", onJoined);
      socket.off("group:member-joined", onMemberJoined);
      socket.off("group:member-left", onMemberLeft);
      socket.off("connect", join);
      window.removeEventListener("pagehide", departQuietly);
      departQuietly();
    };
  }, [roomId, departQuietly]);

  function leave() {
    setLeaving(true);
    departQuietly();
    router.push("/dashboard");
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 p-4 md:p-8">
      <header className="space-y-2">
        <h1 className="text-2xl">{title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge level={level} />
          <span className="text-sm font-semibold text-muted">{topic}</span>
        </div>
      </header>

      <section aria-label="People in this room" className="space-y-2">
        <h2 className="text-sm font-extrabold text-muted">
          In the room ({members.length})
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {members.map((member) => (
            <li
              key={member.userId}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 border-line bg-surface p-4 text-center"
            >
              <Avatar
                user={{
                  id: member.userId,
                  displayName: member.name,
                  avatarUpdatedAt: member.avatarUpdatedAt,
                }}
                size={56}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">
                  {member.userId === selfUserId ? "You" : member.name}
                </p>
                <div className="flex items-center justify-center gap-1 pt-0.5">
                  {member.level && <Badge level={member.level} size="sm" />}
                  {member.isHost && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-surface-raised px-2 py-0.5 text-xs font-bold text-muted">
                      <Crown className="size-3" aria-hidden />
                      Host
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Deliberately not a fake mute button. */}
      <section className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-line p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface-raised">
          <Mic className="size-5 text-muted" aria-hidden />
        </span>
        <p className="text-sm text-muted">
          <span className="font-bold text-text">Voice is coming next.</span> For now this room
          shows who is here — the audio controls will appear right here.
        </p>
      </section>

      <Button variant="secondary" fullWidth onClick={leave} loading={leaving}>
        <LogOut className="size-4" aria-hidden />
        Leave room
      </Button>
    </main>
  );
}
