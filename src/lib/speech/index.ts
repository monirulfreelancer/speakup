"use client";

import type { SpeechRecognitionProvider, SpeechSynthesisProvider } from "./types";
import { BrowserSpeechRecognition } from "./browser-stt";
import { BrowserSpeechSynthesis } from "./browser-tts";

/*
 * Provider factories. The provider name comes from public config so a
 * server-side fallback (Deepgram/Whisper for STT, ElevenLabs/OpenAI for TTS)
 * becomes an env change plus one new file implementing the interface —
 * planned specifically for iOS, where the browser engines are weakest.
 */

const STT_PROVIDER = process.env.NEXT_PUBLIC_STT_PROVIDER ?? "browser";
const TTS_PROVIDER = process.env.NEXT_PUBLIC_TTS_PROVIDER ?? "browser";

let stt: SpeechRecognitionProvider | null = null;
let tts: SpeechSynthesisProvider | null = null;

export function getSpeechProvider(): SpeechRecognitionProvider {
  if (!stt) {
    switch (STT_PROVIDER) {
      case "browser":
      default:
        stt = new BrowserSpeechRecognition();
    }
  }
  return stt;
}

export function getVoiceProvider(): SpeechSynthesisProvider {
  if (!tts) {
    switch (TTS_PROVIDER) {
      case "browser":
      default:
        tts = new BrowserSpeechSynthesis();
    }
  }
  return tts;
}

export type { SpeechError, SpeechRecognitionProvider, SpeechSynthesisProvider, VoiceOption } from "./types";
