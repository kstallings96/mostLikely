/**
 * Browser mode: GPT-2 runs in a web worker in the kid's own browser
 * (~250 MB download on first visit). The spinner engine runs on the main
 * thread and asks the worker for probabilities.
 */
import { cryptoRng } from "@/lib/sample";
import type { WorkerRequest, WorkerResponse } from "@/lib/model/protocol";
import { SpinnerEngine } from "./engine";
import type { LoadInfo, SpinnerBackend } from "./types";

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;

export class BrowserBackend implements SpinnerBackend {
  readonly mode = "browser";
  readonly ready: Promise<LoadInfo>;
  private worker: Worker;
  private engine: SpinnerEngine | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor(onProgress?: (loaded: number, total: number) => void) {
    this.worker = new Worker(new URL("../model/worker.ts", import.meta.url), { type: "module" });
    this.ready = new Promise((resolve, reject) => {
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        if (msg.type === "progress") onProgress?.(msg.loaded, msg.total);
        else if (msg.type === "ready") {
          this.engine = new SpinnerEngine({
            encode: (text) => this.request<number[]>({ type: "encode", text }),
            encodeWord: (spaced) => this.request<number[]>({ type: "encodeWord", spaced }),
            next: (ids) => this.request<Float32Array>({ type: "probsAfter", ids }),
            vocab: msg.vocab,
          });
          resolve({ dtype: msg.dtype, loadMs: msg.loadMs });
        } else if (msg.type === "result") {
          this.pending.get(msg.id)?.resolve(msg.value);
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
    this.worker.postMessage({ type: "load" } satisfies WorkerRequest);
  }

  private request<T>(msg: WithoutId<Exclude<WorkerRequest, { type: "load" }>>): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage({ ...msg, id } as WorkerRequest);
    });
  }

  private async getEngine() {
    await this.ready;
    return this.engine!;
  }

  async view(text: string) {
    return (await this.getEngine()).view(text);
  }
  async spin(view: { sentence: string }, n: number) {
    return (await this.getEngine()).spin(view.sentence, n, cryptoRng);
  }
  async wordChance(text: string, word: string) {
    return (await this.getEngine()).wordChance(text, word);
  }
}
