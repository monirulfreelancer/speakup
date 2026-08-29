# The signing key — read this before touching anything

`speakup-release.keystore` in this folder is the app's **permanent identity**.
Android decides whether two APKs are "the same app" by the certificate they
were signed with, not by their name or package id.

What that means in practice:

- **If this keystore is lost, no future APK can ever update an existing
  install.** Every user would have to uninstall SpeakUp (losing local data)
  and install a new app that Android considers unrelated. There is no appeal
  and no recovery — Google cannot help for a sideloaded app.
- **If this keystore leaks, someone else can publish updates that install
  over the real app.** Treat it like a password.

So:

1. **Back it up now.** Copy `speakup-release.keystore` AND the password file
   `.keystore-pass` to at least one place that is not this laptop — a
   password manager's file attachment is ideal (it keeps file and password
   together, encrypted). A private cloud drive also works.
2. **Never commit it.** `.gitignore` already excludes `android/*.keystore`
   and `android/.keystore-pass`. Do not "temporarily" add them.
3. **Never regenerate it casually.** A new keystore = a new app identity =
   the situation in the first bullet, plus the site's
   `/.well-known/assetlinks.json` fingerprint stops matching and every
   installed app falls back to showing a browser address bar.

The certificate's SHA-256 fingerprint (safe to share, committed at
`fingerprint.txt`) is what links the APK to the website in
`src/app/.well-known/assetlinks.json/route.ts`.

Passwords: the keystore password and key password are the same value, stored
in `.keystore-pass` (gitignored, mode 600). The build script reads it from
there.
