import "server-only";
import sharp from "sharp";
import { db } from "@/lib/db";

/*
 * Imports a remote profile picture into the Avatar table, through exactly
 * the same processing as an upload: decode with sharp (which also proves it
 * is really an image), 256px centre-cropped webp, EXIF dropped.
 *
 * Every failure path is swallowed by the caller — a Google account with an
 * unreachable picture still signs in, just with the letter avatar.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 5000;

export async function importAvatarFromUrl(userId: string, url: string): Promise<boolean> {
  // Only http(s), so a crafted profile cannot point this at a local file.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return false;

    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) return false;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) return false;

    const output = await sharp(buffer, { failOn: "error" })
      .rotate()
      .resize(256, 256, { fit: "cover", position: "centre" })
      .webp({ quality: 80 })
      .toBuffer();

    const stored = new Uint8Array(output.length);
    stored.set(output);

    const now = new Date();
    await db.$transaction([
      db.avatar.upsert({
        where: { userId },
        create: { userId, mime: "image/webp", data: stored },
        update: { mime: "image/webp", data: stored },
      }),
      db.user.update({ where: { id: userId }, data: { avatarUpdatedAt: now } }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
