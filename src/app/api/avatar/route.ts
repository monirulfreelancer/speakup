import { NextResponse } from "next/server";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/*
 * Avatar upload.
 *
 * Everything here assumes the client is lying: the declared mime type is
 * ignored in favour of actually decoding the bytes with sharp, and the size
 * is checked from Content-Length BEFORE the body is buffered, so a 500MB
 * "photo" never reaches memory.
 *
 * Re-encoding to webp is also the privacy step: it drops every EXIF tag,
 * including the GPS coordinates phones write into camera photos.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const SIZE_PX = 256;
const MAX_UPLOADS_PER_HOUR = 10;

function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return fail(401, "Please log in again.");
  const userId = session.user.id;

  // Cheap rejection first: refuse on the declared length before buffering.
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BYTES) {
    return fail(413, "That photo is larger than 5 MB. Please choose a smaller one.");
  }

  // Uploads are re-encoded, so they are CPU work: cap them per user per hour.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db.event.count({
    where: { userId, type: "avatar.uploaded", createdAt: { gte: hourAgo } },
  });
  if (recent >= MAX_UPLOADS_PER_HOUR) {
    return fail(429, "You have changed your photo a lot recently. Try again in an hour.");
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const candidate = form.get("file");
    if (candidate instanceof File) file = candidate;
  } catch {
    return fail(400, "That upload could not be read. Please try again.");
  }
  if (!file) return fail(400, "Please choose a photo to upload.");

  if (!ALLOWED_MIME.includes(file.type)) {
    return fail(415, "Please use a JPEG, PNG or WebP image.");
  }
  if (file.size > MAX_BYTES) {
    return fail(413, "That photo is larger than 5 MB. Please choose a smaller one.");
  }

  const input = Buffer.from(await file.arrayBuffer());

  let output: Buffer;
  try {
    // Decoding is the real check: a .jpg that is actually a zip fails here.
    const image = sharp(input, { failOn: "error" });
    const meta = await image.metadata();
    if (!meta.width || !meta.height) {
      return fail(415, "That file is not an image we can read.");
    }
    output = await image
      .rotate() // honour EXIF orientation before the tags are dropped
      .resize(SIZE_PX, SIZE_PX, { fit: "cover", position: "centre" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return fail(415, "That file is not an image we can read.");
  }

  // Prisma's Bytes wants a plain-ArrayBuffer view; sharp returns a Buffer
  // that may be backed by a SharedArrayBuffer.
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
    db.event.create({ data: { userId, type: "avatar.uploaded", payload: {} } }),
  ]);

  return NextResponse.json({ ok: true, version: now.getTime(), bytes: output.length });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return fail(401, "Please log in again.");

  await db.$transaction([
    db.avatar.deleteMany({ where: { userId: session.user.id } }),
    db.user.update({ where: { id: session.user.id }, data: { avatarUpdatedAt: null } }),
  ]);

  return NextResponse.json({ ok: true });
}
