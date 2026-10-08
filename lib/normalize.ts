/**
 * Turning raw GPT-2 tokens into "kid words".
 *
 * GPT-2 tokens usually carry a leading space (" dog") when they start a new
 * word, and no space when they continue one ("ite" in "pet|ite"). A token
 * becomes a kid word only if it starts a new word and is made of plain
 * letters/numbers once attached punctuation is dropped. Sentence-ending
 * punctuation becomes "(sentence ends)". Everything else (commas, quotes,
 * word fragments, odd bytes) becomes "other".
 */

export const END_KEY = "(sentence ends)";
export const OTHER_KEY = "(other)";
/** Display-only: the Peek bar that groups real words below the top few. */
export const OTHER_WORDS_KEY = "(other words)";

export type NormalizedToken =
  | { kind: "word"; word: string }
  | { kind: "end" }
  | { kind: "other" };

const SENTENCE_END = /^[.!?…]+["'”’)\]]*$/;
const EDGE_PUNCT = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
const KID_WORD = /^[a-z0-9]+(?:['’-][a-z0-9]+)*$/;
const REAL_ONE_LETTER = new Set(["a", "i", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
// Two-letter tokens like " st", " ch", " al" are usually word starts.
// These are the two-letter ones that are real words for kids.
const REAL_TWO_LETTER = new Set(
  "am an as at be by do go he hi if in is it me my no of oh ok on or ox so to tv up us we yo pa ma dr mr ms".split(" "),
);

/** GPT-2's end-of-text marker: the model thinks the passage is over. */
export const EOS_TEXT = "<|endoftext|>";

export function normalizeToken(raw: string): NormalizedToken {
  if (raw.includes("\n") || raw === EOS_TEXT) return { kind: "end" };
  if (raw.includes("\uFFFD")) return { kind: "other" }; // partial UTF-8 byte

  const startsWord = /^\s/.test(raw);
  const trimmed = raw.trim();
  if (trimmed === "") return { kind: "other" };
  if (SENTENCE_END.test(trimmed)) return { kind: "end" };

  const stripped = stripEdges(trimmed.toLowerCase());
  if (stripped === "" || !startsWord) return { kind: "other" };
  if (!KID_WORD.test(stripped)) return { kind: "other" };
  // " p", " b"… are usually the start of a longer word, not a word.
  if (stripped.length === 1 && !REAL_ONE_LETTER.has(stripped)) return { kind: "other" };
  if (stripped.length === 2 && /^[a-z]+$/.test(stripped) && !REAL_TWO_LETTER.has(stripped)) {
    return { kind: "other" };
  }
  return { kind: "word", word: stripped };
}

/** Drop punctuation attached to the start or end of a word. */
export function stripEdges(s: string): string {
  return s.replace(EDGE_PUNCT, "");
}

/** Collapse target-word plurals ("dogs" → "dog") using the hand-made map. */
export function toKidWord(word: string, plurals: Record<string, string>): string {
  return plurals[word] ?? word;
}

/** The merge key for a raw token: a kid word, END_KEY, or OTHER_KEY. */
export function tokenKey(raw: string, plurals: Record<string, string>): string {
  const n = normalizeToken(raw);
  if (n.kind === "word") return toKidWord(n.word, plurals);
  return n.kind === "end" ? END_KEY : OTHER_KEY;
}

/** Split typed text into lowercase words with edge punctuation removed. */
export function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map(stripEdges)
    .filter((w) => w !== "");
}

/** Friendly label for a merge key. */
export function keyLabel(key: string): string {
  if (key === END_KEY) return "(sentence ends)";
  if (key === OTHER_KEY) return "pieces & punctuation";
  if (key === OTHER_WORDS_KEY) return "other words";
  return key;
}
