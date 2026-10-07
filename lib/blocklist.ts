import { BLOCKLIST } from "@/config/blocklist";
import { stripEdges, toKidWord, wordsOf } from "./normalize";

export function makeBlockSet(list: string[] = BLOCKLIST): Set<string> {
  return new Set(list.map((w) => w.trim().toLowerCase()).filter(Boolean));
}

/** True if a normalized word (or its simple singular) is blocked. */
export function isBlockedWord(
  word: string,
  blockSet: Set<string>,
  plurals: Record<string, string> = {},
): boolean {
  const w = word.toLowerCase();
  if (blockSet.has(w) || blockSet.has(toKidWord(w, plurals))) return true;
  if (w.endsWith("es") && blockSet.has(w.slice(0, -2))) return true;
  if (w.endsWith("s") && blockSet.has(w.slice(0, -1))) return true;
  return false;
}

/** Blocked words found in what a kid typed (empty if the text is fine). */
export function findBlockedWords(
  text: string,
  blockSet: Set<string>,
  plurals: Record<string, string> = {},
): string[] {
  return wordsOf(text).filter((w) => isBlockedWord(w, blockSet, plurals));
}

/**
 * One flag per vocab entry: 1 if that token must never be spun. Checks the
 * token's text whether or not it starts a new word, so a no-space token that
 * spells a whole blocked word is caught too.
 */
export function buildBlockedMask(
  tokenTexts: string[],
  blockSet: Set<string>,
  plurals: Record<string, string> = {},
): Uint8Array {
  const mask = new Uint8Array(tokenTexts.length);
  tokenTexts.forEach((raw, id) => {
    const bare = stripEdges(raw.trim().toLowerCase());
    if (bare && isBlockedWord(bare, blockSet, plurals)) mask[id] = 1;
  });
  return mask;
}

/**
 * Zero out blocked tokens and rescale the rest to sum to 1. Returns a new
 * array; the input is not modified.
 */
export function applyBlockedMask(
  probs: ArrayLike<number>,
  mask: Uint8Array,
): Float64Array {
  const out = new Float64Array(probs.length);
  let total = 0;
  for (let i = 0; i < probs.length; i++) {
    const p = mask[i] ? 0 : probs[i];
    out[i] = p;
    total += p;
  }
  if (!(total > 0)) throw new Error("Every token was blocked");
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
