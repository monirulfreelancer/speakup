import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRoomForMember } from "@/server/rooms";
import { RoomScreen } from "./room-screen";

export const metadata = { title: "Room — SpeakUp" };

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Only a live participant may see the room. Everyone else goes Home
  // rather than to an error page — this is a normal thing to happen when a
  // room closes while you were on your way to it.
  const room = await getRoomForMember(roomId, session.user.id);
  if (!room) redirect("/dashboard");

  return (
    <RoomScreen
      roomId={room.id}
      title={room.title}
      topic={room.topic}
      level={room.level}
      selfUserId={session.user.id}
      initialMembers={room.members.map((m) => ({
        userId: m.id,
        name: m.name,
        level: m.cefrLevel,
        avatarUpdatedAt: m.avatarUpdatedAt?.toISOString() ?? null,
        isHost: m.isHost,
      }))}
    />
  );
}
