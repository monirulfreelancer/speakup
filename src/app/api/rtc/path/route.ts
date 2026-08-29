import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/*
 * Records which ICE path a call actually used. The relay rate across real
 * calls is what decides whether coturn stays on this VPS (relayed audio
 * costs bandwidth) or moves to a hosted service.
 */

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  roomId: z.string().min(1),
  type: z.enum(["host", "srflx", "prflx", "relay"]),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  // Only a participant may stamp their own call, and only once.
  const result = await db.match.updateMany({
    where: {
      roomId: body.roomId,
      candidatePairType: null,
      OR: [{ userAId: session.user.id }, { userBId: session.user.id }],
    },
    data: { candidatePairType: body.type },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
