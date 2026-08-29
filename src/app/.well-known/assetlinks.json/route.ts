import { NextResponse } from "next/server";

/*
 * Digital Asset Links: proves to Android that io.speakup.app and this origin
 * are the same publisher. Without this file (or with a wrong fingerprint)
 * the TWA runs, but with a Chrome address bar pinned to the top instead of
 * fullscreen.
 *
 * The fingerprint is the SHA-256 of the release signing certificate in
 * android/speakup-release.keystore (also saved at android/fingerprint.txt).
 * It changes ONLY if the keystore is regenerated — which must never happen
 * casually; see android/SIGNING.md.
 */

const FINGERPRINT =
  "5C:92:43:54:00:D2:5B:36:CA:77:FB:88:EE:64:E5:AA:3F:80:BD:EA:B2:ED:CA:56:21:DC:6B:74:C5:BD:F1:5C";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "io.speakup.app",
          sha256_cert_fingerprints: [FINGERPRINT],
        },
      },
    ],
    { headers: { "Content-Type": "application/json" } },
  );
}
