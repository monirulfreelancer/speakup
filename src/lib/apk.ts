import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

/*
 * Real APK facts, read from the file and the TWA manifest at request time
 * rather than typed into the page by hand — a hardcoded "1.9 MB, v0.1.0"
 * silently goes stale the first time the app is rebuilt.
 */

export const APK_PATH = path.join(process.cwd(), "public", "downloads", "speakup.apk");

export type ApkInfo = {
  version: string;
  bytes: number;
  sizeLabel: string;
  builtAt: Date;
  fileName: string;
} | null;

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/** Null when no APK has been built into this image yet. */
export async function getApkInfo(): Promise<ApkInfo> {
  try {
    const stats = await stat(APK_PATH);

    /*
     * The version is written beside the APK by android/build.sh, because
     * android/twa-manifest.json is NOT in the web image (android/ is
     * dockerignored) — reading it there would silently yield no version in
     * production while looking fine locally. Falls back to the manifest for
     * a local checkout built before that script ran.
     */
    let version = "";
    try {
      version = (
        await readFile(path.join(process.cwd(), "public", "downloads", "apk-version.txt"), "utf8")
      ).trim();
    } catch {
      try {
        const raw = await readFile(path.join(process.cwd(), "android", "twa-manifest.json"), "utf8");
        version = (JSON.parse(raw) as { appVersionName?: string }).appVersionName ?? "";
      } catch {
        version = "";
      }
    }

    return {
      version,
      bytes: stats.size,
      sizeLabel: formatSize(stats.size),
      builtAt: stats.mtime,
      fileName: version ? `speakup-${version}.apk` : "speakup.apk",
    };
  } catch {
    return null;
  }
}
