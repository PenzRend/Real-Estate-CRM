// Whisper invents text for silence: subtitle credits, "Köszönöm a figyelmet",
// often in capitals ("A TORONTÓI KÖZÖNSÉG..."). These keep only what was
// actually said; an empty result means "nothing was said".

export type Segment = { text?: string; no_speech_prob?: number; avg_logprob?: number; compression_ratio?: number };

/** The transcript without the segments the model itself marks as probably not speech. */
export function spokenText(body: { text?: string; segments?: Segment[] }): string {
  if (!Array.isArray(body.segments) || !body.segments.length) return (body.text ?? "").trim();
  return body.segments
    .filter((s) => {
      const noSpeech = s.no_speech_prob ?? 0;
      const logprob = s.avg_logprob ?? 0;
      // Whisper's own rule (quiet and unsure), a near-certain "no speech", and looping repeats.
      if (noSpeech > 0.6 && logprob < -1) return false;
      if (noSpeech > 0.9) return false;
      if ((s.compression_ratio ?? 0) > 2.6) return false;
      return true;
    })
    .map((s) => (s.text ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

const WHOLE = new Set(["köszönöm", "köszönöm szépen", "köszönöm a figyelmet", "köszönöm hogy megnézted", "köszönöm hogy megnéztétek", "sziasztok", "viszlát"]);
const PARTS = ["felirat", "amara.org", "iratkozz fel", "feliratkozás"];

/** A transcript that is almost surely invented: all capitals, or a typical credit or sign-off line. */
export function looksMadeUp(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  // A lone "A" or "Ö": noise, not a command or a note.
  if (letters.length < 3) return true;
  if (letters.length >= 6) {
    const upper = letters.filter((c) => c !== c.toLowerCase()).length;
    if (upper / letters.length > 0.85) return true;
  }
  const plain = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.\s]/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/\.$/, "")
    .trim();
  if (WHOLE.has(plain)) return true;
  return plain.split(" ").length <= 12 && PARTS.some((p) => plain.includes(p));
}

const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** Whisper repeating the hint it was given (it does on silence): most of the words come from it, in a row. */
export function echoesHint(text: string, hint: string): boolean {
  const said = words(text).join(" ");
  return said.length >= 8 && words(hint).join(" ").includes(said);
}
