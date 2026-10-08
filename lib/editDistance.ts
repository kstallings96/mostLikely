import { wordsOf } from "./normalize";

/**
 * Word-level Levenshtein distance: the fewest single-word swaps, additions
 * or deletions to turn sentence `a` into sentence `b`. Case and attached
 * punctuation are ignored ("Dog!" = "dog").
 */
export function wordEditDistance(a: string, b: string): number {
  const x = wordsOf(a);
  const y = wordsOf(b);
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1, // delete
        cur[j - 1] + 1, // add
        prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1), // swap
      );
    }
    prev = cur;
  }
  return prev[y.length];
}
