import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { APK_PATH, getApkInfo } from "@/lib/apk";

/*
 * Serves the APK with the headers Android actually wants: the package
 * mime type, and a filename carrying the version so a user's downloads
 * folder does not fill with indistinguishable "speakup.apk" files.
 *
 * Streamed rather than buffered — it is ~2MB and there is no reason to
 * hold that in memory per request.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const info = await getApkInfo();
  if (!info) return new Response("Not found", { status: 404 });

  const stream = Readable.toWeb(createReadStream(APK_PATH)) as WebReadableStream<Uint8Array>;

  return new Response(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": `attachment; filename="${info.fileName}"`,
      "Content-Length": String(info.bytes),
      // Never cached: a new build must not be shadowed by an old file.
      "Cache-Control": "no-store",
    },
  });
}
