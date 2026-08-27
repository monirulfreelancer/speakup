/*
 * Shared voice loading. speechSynthesis.getVoices() returns [] until the
 * async `voiceschanged` event fires on some browsers (Chrome in particular),
 * so every consumer needs the same load-then-listen dance. This is the one
 * copy of it — the settings page and the TTS provider both use it.
 *
 * English voices are listed first (it's an English-practice app), with
 * en-US/en-GB ahead of other English variants.
 */

export function sortVoicesEnglishFirst(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const score = (v: SpeechSynthesisVoice) => {
    const lang = v.lang.toLowerCase();
    if (lang.startsWith("en-us") || lang.startsWith("en-gb")) return 0;
    if (lang.startsWith("en")) return 1;
    return 2;
  };
  return [...voices].sort((a, b) => score(a) - score(b));
}

/** Resolves with the voice list, waiting for `voiceschanged` if it's empty. */
export function loadVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve([]);
  }

  const immediate = window.speechSynthesis.getVoices();
  if (immediate.length > 0) return Promise.resolve(sortVoicesEnglishFirst(immediate));

  return new Promise((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener("voiceschanged", settle);
      resolve(sortVoicesEnglishFirst(window.speechSynthesis.getVoices()));
    };
    window.speechSynthesis.addEventListener("voiceschanged", settle);
    // Some browsers never fire the event (e.g. no voices installed) — don't
    // hang forever.
    setTimeout(settle, timeoutMs);
  });
}

/**
 * Subscribes to the voice list: calls the callback now (if voices exist) and
 * again whenever `voiceschanged` fires. Returns an unsubscribe function.
 * For UI like the settings voice picker that should stay live.
 */
export function subscribeVoices(
  callback: (voices: SpeechSynthesisVoice[]) => void,
): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return () => {};
  }
  const emit = () => callback(sortVoicesEnglishFirst(window.speechSynthesis.getVoices()));
  emit();
  window.speechSynthesis.addEventListener("voiceschanged", emit);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", emit);
}
