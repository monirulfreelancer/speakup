import { db } from "@/lib/db";

/*
 * Serves a stored avatar.
 *
 * No auth: avatars are already visible to every signed-in user, and gating
 * the image would break caching for no gain. A missing user and a missing
 * avatar return the SAME 404, so this cannot be used to probe which user
 * ids exist.
 *
 * Immutable caching is safe because callers append ?v=<avatarUpdatedAt>,
 * so a new photo is a new URL.
 */

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  const avatar = await db.avatar.findUnique({
    where: { userId },
    select: { data: true, mime: true },
  });
  if (!avatar) return new Response("Not found", { status: 404 });

  // Copy into a plain ArrayBuffer-backed view: Buffer may sit on a
  // SharedArrayBuffer, which BodyInit does not accept.
  const bytes = new Uint8Array(avatar.data.length);
  bytes.set(avatar.data);

  return new Response(bytes, {
    headers: {
      "Content-Type": avatar.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(avatar.data.length),
    },
  });
}
