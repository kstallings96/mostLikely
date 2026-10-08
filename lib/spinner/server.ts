/**
 * Server mode, server side: one GPT-2 for the whole class, loaded when the
 * server starts and kept in memory. Model calls run one at a time (each is
 * ~0.1–0.25 s), which a classroom of ~30 kids comfortably fits within.
 *
 * Model files are cached in .cache/transformers after the first download, so
 * later starts work without internet.
 */
import path from "node:path";
import { env } from "@huggingface/transformers";
import { decodeVocab, encodeText, encodeWord, loadGpt2, probsAfterIds, vocabSize } from "@/lib/model/core";
import { SpinnerEngine } from "./engine";
import type { ServerStatus } from "./remote";

env.cacheDir = path.resolve(".cache/transformers");

type Holder = { status: ServerStatus; engine: Promise<SpinnerEngine> | null };
// Kept on globalThis so dev-server hot reloads don't load the model again.
const g = globalThis as unknown as { __mostLikelyModel?: Holder };
const holder: Holder = (g.__mostLikelyModel ??= { status: { status: "loading" }, engine: null });

export function modelStatus(): ServerStatus {
  return holder.status;
}

export function getEngine(): Promise<SpinnerEngine> {
  if (holder.engine) return holder.engine;
  const t0 = Date.now();
  holder.status = { status: "loading" };
  holder.engine = (async () => {
    const lm = await loadGpt2();
    let queue: Promise<unknown> = Promise.resolve();
    const serial = <T>(fn: () => Promise<T>): Promise<T> => {
      const run = queue.then(fn, fn);
      queue = run.catch(() => undefined);
      return run;
    };
    const engine = new SpinnerEngine({
      encode: async (text) => encodeText(lm, text),
      encodeWord: async (spaced) => encodeWord(lm, spaced),
      next: (ids) => serial(() => probsAfterIds(lm, ids)),
      vocab: decodeVocab(lm.tokenizer, vocabSize(lm)),
    });
    const loadMs = Date.now() - t0;
    holder.status = { status: "ready", loadMs };
    console.log(`[most-likely] GPT-2 (${lm.dtype}) ready on the server in ${(loadMs / 1000).toFixed(1)}s`);
    return engine;
  })();
  holder.engine.catch((err: Error) => {
    holder.status = { status: "error", message: err.message };
    holder.engine = null;
  });
  return holder.engine;
}
