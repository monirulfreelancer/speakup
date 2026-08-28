import { jwtVerify } from "jose";
import type { CefrLevel } from "./events";

/*
 * Socket handshake authentication.
 *
 * The web app mints a short-lived HS256 JWT at /api/realtime/token, signed
 * with the shared NEXTAUTH_SECRET and audience "speakup-realtime". This is
 * deliberately NOT the Auth.js session cookie (that is an encrypted JWE with
 * a derived key); a purpose-minted token keeps the contract simple and the
 * session cookie out of client-side JavaScript entirely.
 */

const secretValue = process.env.NEXTAUTH_SECRET;
if (!secretValue) {
  console.error("NEXTAUTH_SECRET is not set");
  process.exit(1);
}
const secret = new TextEncoder().encode(secretValue);

export const TOKEN_AUDIENCE = "speakup-realtime";

export type SocketUser = {
  id: string;
  name: string;
  photoUrl: string | null;
  level: CefrLevel;
  isAdult: boolean;
};

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export async function verifySocketToken(token: string): Promise<SocketUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { audience: TOKEN_AUDIENCE });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.name !== "string" ||
      !LEVELS.includes(payload.level as CefrLevel)
    ) {
      return null;
    }
    return {
      id: payload.sub,
      name: payload.name,
      photoUrl: typeof payload.photoUrl === "string" ? payload.photoUrl : null,
      level: payload.level as CefrLevel,
      isAdult: payload.isAdult === true,
    };
  } catch {
    return null;
  }
}
