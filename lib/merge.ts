/**
 * The merge layer: GPT-2's ~50k token probabilities → a kid-word spinner.
 *
 * Pipeline for one sentence:
 *   raw softmax probs → zero blocked tokens & rescale (blocklist.ts)
 *   → sum probabilities of tokens that share a kid word (" dog", " dogs",
 *     " Dog", "dog." all → "dog") → sorted entries.
 *
 * We merge the FULL vocabulary rather than a top-100 cut, so the bars stay
 * honest: whatever probability isn't in the top kid words shows up as
 * "other" instead of being silently rescaled away.
 */
import { applyBlockedMask } from "./blocklist";
import { END_KEY, OTHER_KEY, OTHER_WORDS_KEY, tokenKey } from "./normalize";

export interface VocabIndex {
  /** Decoded text of each token id. */
  texts: string[];
  /** Merge key of each token id (kid word, END_KEY or OTHER_KEY). */
  keys: string[];
}

export function buildVocabIndex(
  texts: string[],
  plurals: Record<string, string>,
): VocabIndex {
  return { texts, keys: texts.map((t) => tokenKey(t, plurals)) };
}

export interface XrayToken {
  id: number;
  text: string;
  p: number;
}

export interface MergedEntry {
  key: string;
  p: number;
  /** Highest-probability raw tokens behind this entry (for X-ray). */
  tokens: XrayToken[];
  /** How many raw tokens fed into this entry. */
  tokenCount: number;
  /** Leftover bars only: the biggest entries folded in, and how many in all. */
  parts?: { key: string; p: number }[];
  partCount?: number;
}

export interface MergedDist {
  /** All kid words, END and OTHER, sorted by probability (high → low). */
  entries: MergedEntry[];
  /** Token-level probabilities after blocking; spins sample from these. */
  tokenProbs: Float64Array;
  index: VocabIndex;
}

export function mergeDistribution(
  rawProbs: ArrayLike<number>,
  index: VocabIndex,
  blockedMask: Uint8Array,
  xrayTokensPerBar = 8,
): MergedDist {
  const tokenProbs = applyBlockedMask(rawProbs, blockedMask);
  const byKey = new Map<string, { p: number; ids: number[] }>();

  for (let id = 0; id < tokenProbs.length; id++) {
    const p = tokenProbs[id];
    if (p === 0) continue;
    const key = index.keys[id];
    let e = byKey.get(key);
    if (!e) byKey.set(key, (e = { p: 0, ids: [] }));
    e.p += p;
    e.ids.push(id);
  }

  const entries: MergedEntry[] = [];
  for (const [key, { p, ids }] of byKey) {
    ids.sort((a, b) => tokenProbs[b] - tokenProbs[a]);
    entries.push({
      key,
      p,
      tokenCount: ids.length,
      tokens: ids
        .slice(0, xrayTokensPerBar)
        .map((id) => ({ id, text: index.texts[id], p: tokenProbs[id] })),
    });
  }
  entries.sort((a, b) => b.p - a.p);
  return { entries, tokenProbs, index };
}

export function probOf(dist: MergedDist, key: string): number {
  return dist.entries.find((e) => e.key === key)?.p ?? 0;
}

/**
 * Bars for the Peek view, always summing to 1:
 *   - the top `n` kid words (and "(sentence ends)" if it makes the cut),
 *   - "other words": the long tail of real words below the cut,
 *   - "pieces & punctuation": word fragments, commas, quotes, and
 *     "(sentence ends)" if it missed the cut.
 * Two separate leftover bars, because "thousands of rare words" and
 * "commas and word scraps" are different ideas for kids.
 */
export function displayBars(dist: MergedDist, n: number, xrayTokensPerBar = 8): MergedEntry[] {
  const shown = dist.entries.filter((e) => e.key !== OTHER_KEY).slice(0, n);
  const shownKeys = new Set(shown.map((e) => e.key));
  const rest = dist.entries.filter((e) => !shownKeys.has(e.key));
  const isPiece = (e: MergedEntry) => e.key === OTHER_KEY || e.key === END_KEY;
  const leftovers = [
    combine(OTHER_WORDS_KEY, rest.filter((e) => !isPiece(e)), xrayTokensPerBar),
    combine(OTHER_KEY, rest.filter(isPiece), xrayTokensPerBar),
  ];
  return [...shown, ...leftovers.filter((b) => b.p > 0)];
}

/** How many folded-in entries a leftover bar keeps for drawing slices. */
const MAX_PARTS = 60;

function combine(key: string, entries: MergedEntry[], xrayTokensPerBar: number): MergedEntry {
  return {
    key,
    p: entries.reduce((s, e) => s + e.p, 0),
    parts: entries.slice(0, MAX_PARTS).map((e) => ({ key: e.key, p: e.p })),
    partCount: entries.length,
    tokenCount: entries.reduce((s, e) => s + e.tokenCount, 0),
    tokens: entries
      .flatMap((e) => e.tokens)
      .sort((a, b) => b.p - a.p)
      .slice(0, xrayTokensPerBar),
  };
}

/** Compact top-k summary for research logs: [{word, p}]. */
export function topK(dist: MergedDist, k: number): { word: string; p: number }[] {
  return dist.entries.slice(0, k).map((e) => ({ word: e.key, p: round4(e.p) }));
}

function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}
