import { SpeechTestSurface } from "./speech-test";

export const metadata = { title: "Practice — SpeakUp" };

// Phase 3 dev surface: exercises the whole speech layer (capabilities →
// permission → STT → TTS) with no AI. Phase 4 replaces this with the real
// conversation UI on the same components.
export default function PracticeAiPage() {
  return <SpeechTestSurface />;
}
