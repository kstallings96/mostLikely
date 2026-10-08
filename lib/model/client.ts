/**
 * Main-thread handle on the GPT-2 worker, plus the merge layer: one call
 * turns a sentence into a kid-word spinner.
 */
import { GAME, PLURALS } from "@/config/game";
import { buildBlockedMask, makeBlockSet } from "@/lib/blocklist";
import { buildVocabIndex, mergeDistribution, type MergedDist, type VocabIndex } from "@/lib/merge";
import type { WorkerRequest, WorkerResponse } from "./protocol";

export interface LoadInfo {
  dtype: string;
  loadMs: number;
}

export class SpinnerModel {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, { resolve: (p: Float32Array) => void; reject: (e: Error) => void }>();
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
          this.mask = buildBlockedMask(msg.vocab, makeBlockSet(), PLURALS);
          resolve({ dtype: msg.dtype, loadMs: msg.loadMs });
        } else if (msg.type === "probs") {
          this.pending.get(msg.id)?.resolve(msg.probs);
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

  /** Blocked-and-merged next-word spinner for a sentence. */
  async spinnerFor(text: string): Promise<MergedDist> {
    await this.ready;
    const id = this.nextId++;
    const probs = await new Promise<Float32Array>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ type: "predict", id, text });
    });
    return mergeDistribution(probs, this.index!, this.mask!, GAME.xrayTokensPerBar);
  }

  dispose() {
    this.worker.terminate();
  }
}
