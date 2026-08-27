/*
 * Provider-agnostic speech interfaces. The browser implementations are
 * Phase 3; a server-side STT (Deepgram/Whisper) or TTS (ElevenLabs/OpenAI)
 * must be able to implement these same interfaces and swap in via config
 * without touching any UI code.
 */

export type SpeechError = {
  code: "no-permission" | "no-speech" | "network" | "unsupported" | "aborted" | "unknown";
  message: string;
};

export type VoiceOption = {
  name: string;
  lang: string;
};

export interface SpeechRecognitionProvider {
  isSupported(): boolean;
  start(opts: {
    lang: string;
    interimResults: boolean;
    onInterim: (text: string) => void;
    onFinal: (r: { text: string; confidence: number }) => void;
    onError: (e: SpeechError) => void;
  }): Promise<void>;
  stop(): void;
  abort(): void;
}

export interface SpeechSynthesisProvider {
  isSupported(): boolean;
  speak(
    text: string,
    opts: { voice?: string; rate?: number; onStart?: () => void; onEnd?: () => void },
  ): Promise<void>;
  cancel(): void;
  getVoices(): Promise<VoiceOption[]>;
}
