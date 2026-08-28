import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/*
 * Mints the short-lived token the socket handshake presents to the realtime
 * service. The Auth.js session cookie itself (an encrypted, httpOnly JWE)
 * never reaches client-side JavaScript — this purpose-built HS256 JWT does,
 * signed with the same NEXTAUTH_SECRET the realtime service verifies with.
 */

export const dynamic = "force-dynamic";

const TOKEN_AUDIENCE = "speakup-realtime";
const TOKEN_TTL_SECONDS = 5 * 60;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, photoUrl: true, cefrLevel: true, isAdult: true, onboardedAt: true },
  });
  if (!user?.onboardedAt || !user.cefrLevel) {
    return NextResponse.json({ error: "not-onboarded" }, { status: 403 });
  }

  const token = await new SignJWT({
    name: user.name,
    photoUrl: user.photoUrl,
    level: user.cefrLevel,
    isAdult: user.isAdult,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(env.NEXTAUTH_SECRET));

  return NextResponse.json({ token });
}
