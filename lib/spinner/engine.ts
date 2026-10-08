/**
 * The spinner engine: everything between "a sentence" and "spins", built on
 * two model operations (encode text, P(next | token ids)). The same engine
 * runs on the server (server mode) or in the browser's main thread with
 * GPT-2 in a web worker (browser mode).
 */
import { GAME, PLURALS } from "@/config/game";
import { buildBlockedMask, makeBlockSet } from "@/lib/blocklist";
import { spinAndFinish } from "@/lib/finish";
import { buildVocabIndex, displayBars, mergeDistribution, type MergedDist, type VocabIndex } from "@/lib/merge";
import type { Rng, SpinResult } from "@/lib/sample";
import type { SpinnerView, WordChance } from "./types";

export interface ModelOps {
  /** Token ids for a sentence (already cleaned up). */
  encode: (text: string) => Promise<number[]>;
  /** Token ids for a single word with its leading space, e.g. " Fido". */
  encodeWord: (spaced: string) => Promise<number[]>;
  /** P(next token | ids). */
  next: (ids: number[]) => Promise<Float32Array>;
  /** Decoded text of every token id. */
  vocab: string[];
}

/** How many top entries a view carries (guess options, logging, chances). */
const TOP_ENTRIES = 300;
const CACHE_SIZE = 200;

export class SpinnerEngine {
  readonly index: VocabIndex;
  readonly mask: Uint8Array;
  private readonly blockSet = makeBlockSet();
  private cache = new Map<string, Promise<{ dist: MergedDist; ids: number[] }>>();

  constructor(private readonly ops: ModelOps) {
    this.index = buildVocabIndex(ops.vocab, PLURALS);
    this.mask = buildBlockedMask(ops.vocab, this.blockSet, PLURALS);
  }

  /** Merged spinner for a sentence (cached, so re-spinning is cheap). */
  private distFor(text: string) {
    let hit = this.cache.get(text);
    if (!hit) {
      hit = (async () => {
        const ids = await this.ops.encode(text);
        const dist = mergeDistribution(await this.ops.next(ids), this.index, this.mask, GAME.xrayTokensPerBar);
        return { dist, ids };
      })();
      hit.catch(() => this.cache.delete(text));
      this.cache.set(text, hit);
      if (this.cache.size > CACHE_SIZE) this.cache.delete(this.cache.keys().next().value!);
    }
    return hit;
  }

  async view(text: string): Promise<SpinnerView> {
    const { dist } = await this.distFor(text);
    return {
      sentence: text,
      bars: displayBars(dist, GAME.displayBars, GAME.xrayTokensPerBar),
      top: dist.entries.slice(0, TOP_ENTRIES).map((e) => ({ key: e.key, p: e.p })),
    };
  }

  async spin(text: string, n: number, rng: Rng): Promise<SpinResult[]> {
    const { dist, ids } = await this.distFor(text);
    return spinAndFinish(dist, ids, n, rng, {
      next: this.ops.next,
      texts: this.index.texts,
      mask: this.mask,
      blockSet: this.blockSet,
      plurals: PLURALS,
    });
  }

  /**
   * Chance the next word is `word`, even when GPT-2 builds it from several
   * pieces: P(" F") × P("ido" | … " F"). Sums lowercase and Capitalized.
   */
  async wordChance(text: string, word: string): Promise<WordChance> {
    const base = await this.ops.encode(text);
    const lower = word.toLowerCase();
    const spellings = [...new Set([lower, lower[0].toUpperCase() + lower.slice(1)])];
    let total = 0;
    let best = { p: -1, pieces: [] as string[] };
    for (const spelling of spellings) {
      const pieceIds = await this.ops.encodeWord(" " + spelling);
      let p = 1;
      const ids = [...base];
      for (const id of pieceIds) {
        p *= (await this.ops.next(ids))[id];
        ids.push(id);
      }
      total += p;
      if (p > best.p) best = { p, pieces: pieceIds.map((id) => this.index.texts[id]) };
    }
    return { p: total, pieces: best.pieces };
  }
}
