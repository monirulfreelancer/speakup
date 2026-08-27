import { SpeechTestSurface } from "./speech-test";

export const metadata = { title: "Speech test — SpeakUp" };

// Dev-only speech test surface from Phase 3. Not linked in the nav.
export default function SpeechTestPage() {
  return <SpeechTestSurface />;
}
