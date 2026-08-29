#!/bin/sh
#
# Rebuild the signed SpeakUp APK/AAB from twa-manifest.json.
# See README.md in this folder for when and why to run this.

set -eu
cd "$(dirname "$0")"

if [ ! -f .keystore-pass ]; then
  echo "ERROR: android/.keystore-pass is missing. Restore it from your backup" >&2
  echo "(see SIGNING.md) — without it the APK cannot be signed." >&2
  exit 1
fi

PASS="$(cat .keystore-pass)"
export BUBBLEWRAP_KEYSTORE_PASSWORD="$PASS"
export BUBBLEWRAP_KEY_PASSWORD="$PASS"

echo "==> Regenerating the Android project from twa-manifest.json..."
npx bubblewrap update --skipVersionUpgrade

# Bubblewrap points gradle at its own SDK root nested inside cmdline-tools,
# which AGP's target loader refuses ("Failed to find target android-36").
# local.properties outranks the env var, so pin gradle to the standard SDK
# layout at ~/.bubblewrap/android_sdk instead.
echo "sdk.dir=$HOME/.bubblewrap/android_sdk" > local.properties

echo "==> Declaring RECORD_AUDIO (regeneration overwrites AndroidManifest.xml)..."
MANIFEST="app/src/main/AndroidManifest.xml"
if ! grep -q "android.permission.RECORD_AUDIO" "$MANIFEST"; then
  # Insert after the opening <manifest ...> tag.
  perl -0pi -e 's{(<manifest[^>]*>)}{$1\n    <uses-permission android:name="android.permission.RECORD_AUDIO"/>}' "$MANIFEST"
fi
grep -q "android.permission.RECORD_AUDIO" "$MANIFEST" || { echo "RECORD_AUDIO patch failed" >&2; exit 1; }

echo "==> Building signed APK and AAB..."
npx bubblewrap build --skipPwaValidation

mkdir -p build
cp app-release-signed.apk build/speakup.apk
cp app-release-bundle.aab build/speakup.aab 2>/dev/null || true

echo "==> Copying the APK into the web app (served at /downloads/speakup.apk)..."
cp build/speakup.apk ../public/downloads/speakup.apk

echo ""
echo "Done."
echo "  APK: android/build/speakup.apk (and public/downloads/speakup.apk)"
echo "  AAB: android/build/speakup.aab (Play Store only — ignore for direct download)"
echo ""
echo "Remember: commit public/downloads/speakup.apk and redeploy the web app"
echo "so the new APK is actually served."
