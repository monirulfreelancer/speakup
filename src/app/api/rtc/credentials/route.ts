import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

/*
 * Short-lived TURN credentials, coturn's REST-API shared-secret scheme:
 *
 *   username = "<unix expiry>:<userId>"
 *   password = base64(HMAC-SHA1(username, shared secret))
 *
 * coturn recomputes the same HMAC from its own secret and accepts the
 * credential until the embedded timestamp passes. Static TURN credentials
 * would otherwise sit in client JavaScript forever, and a leaked one is an
 * open relay someone else pays for.
 *
 * The secret NEVER leaves the server: only the derived username/password go
 * to the browser, and only for ten minutes.
 */

export const dynamic = "force-dynamic";

const TTL_SECONDS = 600;
const STUN_FALLBACK = "stun:stun.l.google.com:19302";

let warnedNoTurn = false;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const urls: string[] = [STUN_FALLBACK];

  if (!env.TURN_SECRET) {
    // Degraded but usable: direct and reflexive candidates still connect on
    // most networks. Warn once so it is visible in logs without flooding.
    if (!warnedNoTurn) {
      warnedNoTurn = true;
      console.warn(
        "[rtc] TURN_SECRET is not set — serving STUN-only ICE servers. Calls will fail on symmetric NAT and some mobile networks.",
      );
    }
    return NextResponse.json({ iceServers: [{ urls }], turn: false });
  }

  const expiry = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const username = `${expiry}:${session.user.id}`;
  const credential = createHmac("sha1", env.TURN_SECRET).update(username).digest("base64");

  const turnUrls = (env.TURN_URLS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  return NextResponse.json({
    iceServers: [
      { urls: [STUN_FALLBACK] },
      ...(turnUrls.length > 0
        ? [{ urls: turnUrls, username, credential, ...(env.TURN_REALM ? { realm: env.TURN_REALM } : {}) }]
        : []),
    ],
    turn: turnUrls.length > 0,
    expiresAt: expiry,
  });
}
