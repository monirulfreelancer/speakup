/*
 * Incremental sentence assembly over a streamed AI reply, with the meta
 * footer held back so it is never displayed or spoken.
 *
 * push(chunk) returns { sentences, displayText }:
 * - sentences: newly COMPLETED sentences since the last call (feed to TTS)
 * - displayText: everything safe to render so far (meta stripped/held)
 * flush() returns the final trailing sentence once the stream ends.
 */

const META_GLOBAL = /<<meta:\{.*?\}>>/g;
// A trailing "<" or "<<meta:{..." that MIGHT become the meta footer — held
// back until it either completes (then stripped) or turns out to be prose.
const PARTIAL_META_TAIL = /<<?(?:m(?:e(?:t(?:a(?::.*)?)?)?)?)?$/;

const SENTENCE_BOUNDARY = /([.!?…]+["')\]]*)(\s+|$)/;

export class SentenceStream {
  private buffer = "";
  private emitted = "";

  push(chunk: string): { sentences: string[]; displayText: string } {
    this.buffer += chunk;

    // Remove any completed meta footer outright.
    this.buffer = this.buffer.replace(META_GLOBAL, "");

    // Hold back a possible partial meta at the end of the buffer.
    const partial = this.buffer.match(PARTIAL_META_TAIL);
    const holdFrom = partial && partial[0].length > 0 ? partial.index! : this.buffer.length;
    let available = this.buffer.slice(0, holdFrom);

    const sentences: string[] = [];
    let match: RegExpMatchArray | null;
    while ((match = available.match(SENTENCE_BOUNDARY)) && match.index !== undefined) {
      const end = match.index + match[1].length;
      const sentence = available.slice(0, end).trim();
      if (sentence) sentences.push(sentence);
      this.emitted += available.slice(0, end + match[2].length);
      available = available.slice(end + match[2].length);
    }
    this.buffer = available + this.buffer.slice(holdFrom);

    return { sentences, displayText: (this.emitted + available).trimEnd() };
  }

  /** Call when the stream ends; returns any final unterminated sentence. */
  flush(): { sentence: string | null; displayText: string } {
    const rest = this.buffer.replace(META_GLOBAL, "").replace(PARTIAL_META_TAIL, "").trim();
    this.emitted += rest;
    this.buffer = "";
    return { sentence: rest || null, displayText: this.emitted.trim() };
  }
}
