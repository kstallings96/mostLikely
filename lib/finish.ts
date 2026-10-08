/**
 * "Finish the word": when a spin lands on the start of a longer word (" D")
 * or an opening quote (' "'), keep asking GPT-2 for the next piece, spinning
 * it the same weighted way, until the word is done. " D" + "uke" → "duke".
 * This is what the AI would actually have written, so kids see names and
 * words instead of a grey "pieces" result.
 */
import { applyBlockedMask, isBlockedWord } from "./blocklist";
import { probOf, type MergedDist } from "./merge";
import { normalizeToken, toKidWord } from "./normalize";
import { sampleIndex, spin, type Rng, type SpinResult } from "./sample";

/** A word start like " D" / " st", or an opening quote/bracket like ' "'. */
export function needsFinishing(text: string): boolean {
  if (/^ ["'“‘(]$/.test(text)) return true;
  return /^ [A-Za-z]+$/.test(text) && normalizeToken(text).kind === "other";
}

/** A piece that carries on the current word: letters (or ' and -) with no leading space. */
function continuesWord(text: string): boolean {
  return /^[A-Za-z][A-Za-z'’-]*$/.test(text);
}

export interface FinishDeps {
  /** P(next token | these token ids), from the model. */
  next: (ids: number[]) => Promise<Float32Array>;
  /** Decoded text per token id. */
  texts: string[];
  /** Blocked token ids (never drawn). */
  mask: Uint8Array;
  blockSet: Set<string>;
  plurals: Record<string, string>;
  /** Most extra pieces to add after the first one. */
  maxPieces?: number;
}

export interface Finished {
  /** All pieces, including the first: [" D", "uke"]. */
  pieces: string[];
  /** The finished kid word, or null if it never became a word. */
  word: string | null;
  /** Chance of this exact path of pieces. */
  p: number;
}

export async function finishWord(
  contextIds: number[],
  firstId: number,
  firstP: number,
  deps: FinishDeps,
  rng: Rng,
): Promise<Finished> {
  const { next, texts, mask, maxPieces = 4 } = deps;
  const ids = [...contextIds, firstId];
  const pieces = [texts[firstId]];
  let p = firstP;
  for (let i = 0; i < maxPieces; i++) {
    const probs = applyBlockedMask(await next(ids), mask);
    const id = sampleIndex(probs, rng);
    if (!continuesWord(texts[id])) break; // a new word or punctuation: the word is done
    ids.push(id);
    pieces.push(texts[id]);
    p *= probs[id];
  }
  const n = normalizeToken(" " + pieces.join("").trim().replace(/^["'“‘(]+/, ""));
  return { pieces, word: n.kind === "word" ? n.word : null, p };
}

/**
 * Spin `n` times, finishing any spin that lands on a word start or opening
 * quote. A finished word on the blocklist is thrown out and that spin is
 * redone, which is the same as zeroing it out and rescaling.
 */
export async function spinAndFinish(
  dist: MergedDist,
  contextIds: number[],
  n: number,
  rng: Rng,
  deps: FinishDeps,
): Promise<SpinResult[]> {
  const out: SpinResult[] = [];
  while (out.length < n) {
    let result: SpinResult | null = null;
    for (let tries = 0; tries < 10 && !result; tries++) {
      const [r] = spin(dist, 1, rng);
      if (!needsFinishing(r.text)) {
        result = r;
        break;
      }
      const f = await finishWord(contextIds, r.tokenId, dist.tokenProbs[r.tokenId], deps, rng);
      if (!f.word) {
        result = { ...r, pieces: f.pieces };
      } else if (!isBlockedWord(f.word, deps.blockSet, deps.plurals)) {
        const key = toKidWord(f.word, deps.plurals);
        result = { ...r, key, p: Math.max(probOf(dist, key), f.p), pieces: f.pieces };
      }
    }
    // Ten blocked finishes in a row is vanishingly unlikely; fall back to an unfinished spin.
    out.push(result ?? spin(dist, 1, rng)[0]);
  }
  return out;
}
