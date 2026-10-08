/**
 * Main-thread handle on the GPT-2 worker, plus the merge layer: one call
 * turns a sentence into a kid-word spinner.
 */
import { GAME, PLURALS } from "@/config/game";
import { buildBlockedMask, makeBlockSet } from "@/lib/blocklist";
import { buildVocabIndex, mergeDistribution, type MergedDist, type VocabIndex } from "@/lib/merge";
import { spinAndFinish } from "@/lib/finish";
import type { Rng, SpinResult } from "@/lib/sample";
import type { WorkerRequest, WorkerResponse } from "./protocol";

const blockSet = makeBlockSet();

export interface WordChance {
  p: number;
  /** Token pieces for the word, e.g. [" F", "ido"]. */
  pieces: string[];
}

export interface LoadInfo {
  dtype: string;
  loadMs: number;
}

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;

export class SpinnerModel {
  private worker: Worker;
  private nextId = 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private index: VocabIndex | null = null;
  private mask: Uint8Array | null = null;
  readonly ready: Promise<LoadInfo>;

  constructor(onProgress?: (loaded: number, total: number) => void) {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    this.ready = new Promise((resolve, reject) => {
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        if (msg.type === "progress") onProgress?.(msg.loaded, msg.total);
        else if (msg.type === "ready") {
          this.index = buildVocabIndex(msg.vocab, PLURALS);
          this.mask = buildBlockedMask(msg.vocab, blockSet, PLURALS);
          resolve({ dtype: msg.dtype, loadMs: msg.loadMs });
        } else if (msg.type === "probs") {
          this.pending.get(msg.id)?.resolve(msg.ids ? { probs: msg.probs, ids: msg.ids } : msg.probs);
          this.pending.delete(msg.id);
        } else if (msg.type === "wordChance") {
          this.pending.get(msg.id)?.resolve({ p: msg.p, pieces: msg.pieces });
          this.pending.delete(msg.id);
        } else if (msg.type === "error") {
          if (msg.id === undefined) reject(new Error(msg.message));
          else {
            this.pending.get(msg.id)?.reject(new Error(msg.message));
            this.pending.delete(msg.id);
          }
        }
      };
    });
    this.send({ type: "load" });
  }

  private send(msg: WorkerRequest) {
    this.worker.postMessage(msg);
  }

  private request<T>(msg: WithoutId<Extract<WorkerRequest, { id: number }>>): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ ...msg, id } as WorkerRequest);
    });
  }

  /** Blocked-and-merged next-word spinner for a sentence. */
  async spinnerFor(text: string): Promise<MergedDist> {
    await this.ready;
    const { probs, ids } = await this.request<{ probs: Float32Array; ids: number[] }>({ type: "predict", text });
    return { ...mergeDistribution(probs, this.index!, this.mask!, GAME.xrayTokensPerBar), contextIds: ids };
  }

  /**
   * Spin `n` times, finishing spins that land on a word start or opening
   * quote (" D" + "uke" → "duke").
   */
  async spin(dist: MergedDist, n: number, rng: Rng): Promise<SpinResult[]> {
    await this.ready;
    return spinAndFinish(dist, dist.contextIds ?? [], n, rng, {
      next: (ids) => this.request<Float32Array>({ type: "probsAfter", ids }),
      texts: this.index!.texts,
      mask: this.mask!,
      blockSet,
      plurals: PLURALS,
    });
  }

  /**
   * Chance the next word is `word`, chaining pieces for words GPT-2 builds
   * from several tokens ("fido" = " F" + "ido").
   */
  async wordChance(text: string, word: string): Promise<WordChance> {
    await this.ready;
    return this.request<WordChance>({ type: "wordChance", text, word });
  }

  dispose() {
    this.worker.terminate();
  }
}
