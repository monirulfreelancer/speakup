"use client";

/*
 * Capability detection for the speech stack. One call answers "can this
 * device do voice practice, and if not, what do we tell the user?"
 *
 * The cases that matter in the field:
 * - Firefox has no SpeechRecognition at all.
 * - A plain-http origin has no getUserMedia (secure context required).
 * - iOS below 16.4 running as an INSTALLED PWA (standalone display mode)
 *   has no getUserMedia either — but the same page opened in Safari works.
 *   That deserves its own message, because "open it in Safari instead" fixes
 *   it and nothing else does.
 */

export type SpeechCapabilities = {
  speechRecognition: boolean;
  speechSynthesis: boolean;
  secureContext: boolean;
  standalone: boolean;
  ios: boolean;
  /** Major.minor as a number (e.g. 16.3), or null when not iOS/undetectable. */
  iosVersion: number | null;
  /** Everything needed for voice practice is available. */
  supported: boolean;
  /** Human-readable explanation when supported is false. */
  reason: string | null;
};

function detectIosVersion(): { ios: boolean; version: number | null } {
  const ua = navigator.userAgent;
  // iPadOS 13+ masquerades as macOS; the touch-points check catches it.
  const isIos =
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIos) return { ios: false, version: null };

  const match = ua.match(/OS (\d+)[._](\d+)/) ?? ua.match(/Version\/(\d+)\.(\d+)/);
  if (!match) return { ios: true, version: null };
  return { ios: true, version: Number(`${match[1]}.${match[2]}`) };
}

export function getSpeechCapabilities(): SpeechCapabilities {
  if (typeof window === "undefined") {
    return {
      speechRecognition: false,
      speechSynthesis: false,
      secureContext: false,
      standalone: false,
      ios: false,
      iosVersion: null,
      supported: false,
      reason: "Not running in a browser.",
    };
  }

  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  const speechRecognition = Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
  const speechSynthesis = "speechSynthesis" in window;
  const secureContext = window.isSecureContext;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  const { ios, version: iosVersion } = detectIosVersion();

  let reason: string | null = null;

  if (!secureContext) {
    reason =
      "The microphone only works on a secure (https) connection. Open the site via its https address.";
  } else if (ios && standalone && iosVersion !== null && iosVersion < 16.4) {
    reason =
      "On this iOS version the microphone doesn't work in the installed app. Please open the site in Safari instead — everything works there.";
  } else if (!speechRecognition) {
    reason =
      "This browser can't do speech recognition. Chrome (desktop or Android), Edge, or Safari 14.1+ all work.";
  } else if (!speechSynthesis) {
    reason = "This browser can't speak text aloud. Chrome, Edge, or Safari all work.";
  }

  return {
    speechRecognition,
    speechSynthesis,
    secureContext,
    standalone,
    ios,
    iosVersion,
    supported: reason === null,
    reason,
  };
}
