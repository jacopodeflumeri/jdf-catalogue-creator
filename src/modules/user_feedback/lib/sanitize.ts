/**
 * Comment sanitization.
 *
 * The app makes NO LLM calls — feedback is just written to Notion. But the
 * comment is attacker-controlled free text that a downstream (centralized)
 * Notion triage agent will read, so we do the two cheap, non-brittle things
 * that actually help: strip invisible/control characters and hard-cap length.
 *
 * We deliberately do NOT attempt content-based prompt-injection detection here.
 * It produces false positives on legitimate feedback ("ignore the previous
 * screen…") and is trivially bypassed. Semantic defense (delimiting, output
 * allow-listing) belongs in the agent that actually calls the model.
 */
import { FEEDBACK_COMMENT_MAX_LENGTH } from "./config";

// C0/C1 control chars, EXCEPT tab (\x09) and newline (\x0A).
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;

// Zero-width, word-joiner, and bidirectional-control code points. Kept as a
// numeric Set (not a regex) so the source stays plain ASCII and we avoid a
// dynamically-built RegExp — these characters are, by definition, invisible.
const INVISIBLE_CODEPOINTS = new Set<number>([
  0x200b, 0x200c, 0x200d, 0x200e, 0x200f, // ZWSP, ZWNJ, ZWJ, LRM, RLM
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e, // bidi embeddings / overrides
  0x2060, 0x2061, 0x2062, 0x2063, 0x2064, // word joiner + invisible math ops
  0xfeff, // BOM / zero-width no-break space
]);

function stripInvisible(input: string): string {
  let out = "";
  for (const ch of input) {
    if (!INVISIBLE_CODEPOINTS.has(ch.codePointAt(0) ?? 0)) {
      out += ch;
    }
  }
  return out;
}

/**
 * Normalize and cap a raw comment. Returns the cleaned string (possibly empty —
 * callers decide whether empty is a validation error).
 */
export function sanitizeComment(raw: string): string {
  if (typeof raw !== "string") return "";

  const cleaned = stripInvisible(raw.replace(CONTROL_CHARS, ""))
    .replace(/\r\n?/g, "\n") // normalize newlines
    .replace(/\n{3,}/g, "\n\n") // collapse excessive blank lines
    .trim();

  return cleaned.slice(0, FEEDBACK_COMMENT_MAX_LENGTH);
}
