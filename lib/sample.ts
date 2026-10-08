/**
 * Spinning: drawing words at random in proportion to their probability.
 * This is the scoreboard. Rounds are always judged on spins, never on bars.
 */
import type { MergedDist } from "./merge";
import { probOf } from "./merge";

/** Returns a float in [0, 1). */
export type Rng = () => number;

/** Small seeded RNG for tests and reproducible demos. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const cryptoRng: Rng = () => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
};

/** Index drawn with probability weights[i] / sum(weights). */
export function sampleIndex(weights: ArrayLike<number>, rng: Rng): number {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += weights[i];
  if (!(total > 0)) throw new Error("Cannot sample: all weights are zero");
  let r = rng() * total;
  let last = -1;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    if (w <= 0) continue;
    last = i;
    r -= w;
    if (r < 0) return i;
  }
  return last; // floating-point leftovers land on the last possible index
}

export interface SpinResult {
  /** Merge key (kid word, END_KEY or OTHER_KEY). */
  key: string;
  /** The raw token actually drawn, e.g. " dogs" or "ite". */
  tokenId: number;
  text: string;
  /** Probability of this kid word for the sentence (for "Whoa!" moments). */
  p: number;
  /** Set when the spin landed on a word start and was finished: [" D", "uke"]. */
  pieces?: string[];
}

/**
 * Spin `n` times. Draws a raw token from the blocked-and-rescaled token
 * distribution, then reports its kid word. This is the same as drawing from
 * the merged distribution, but it also tells us which real token came up
 * (useful when a spin lands on "other").
 */
export function spin(dist: MergedDist, n: number, rng: Rng): SpinResult[] {
  const out: SpinResult[] = [];
  for (let i = 0; i < n; i++) {
    const id = sampleIndex(dist.tokenProbs, rng);
    const key = dist.index.keys[id];
    out.push({ key, tokenId: id, text: dist.index.texts[id], p: probOf(dist, key) });
  }
  return out;
}

export function countBy(results: { key: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.key] = (counts[r.key] ?? 0) + 1;
  return counts;
}
