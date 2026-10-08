/// <reference lib="webworker" />
/**
 * Runs GPT-2 off the main thread so the page stays responsive on a
 * Chromebook while the model loads and thinks.
 *
 * Model files are looked for first at /models/Xenova/gpt2/ (put there by
 * `npm run fetch-model`), then on huggingface.co. After the first load the
 * browser keeps them in its cache.
 */
import { env } from "@huggingface/transformers";
import { decodeVocab, loadGpt2, nextTokenProbs, vocabSize, wordChance, type LoadedModel } from "./core";
import type { WorkerRequest, WorkerResponse } from "./protocol";

env.allowLocalModels = true;
env.localModelPath = "/models/";
env.allowRemoteModels = true;
env.useBrowserCache = true;

let lm: LoadedModel | null = null;
const post = (msg: WorkerResponse, transfer: Transferable[] = []) =>
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer);

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      if (lm) return;
      const t0 = performance.now();
      lm = await loadGpt2({
        device: "wasm",
        progress_callback: (p) => {
          if (p.status === "progress_total") {
            post({ type: "progress", loaded: p.loaded, total: p.total });
          }
        },
      });
      post({
        type: "ready",
        vocab: decodeVocab(lm.tokenizer, vocabSize(lm)),
        dtype: lm.dtype,
        loadMs: Math.round(performance.now() - t0),
      });
    } else if (msg.type === "predict") {
      if (!lm) throw new Error("Model not loaded");
      const probs = await nextTokenProbs(lm, msg.text);
      post({ type: "probs", id: msg.id, probs }, [probs.buffer]);
    } else if (msg.type === "wordChance") {
      if (!lm) throw new Error("Model not loaded");
      const { p, pieces } = await wordChance(lm, msg.text, msg.word);
      post({ type: "wordChance", id: msg.id, p, pieces });
    }
  } catch (err) {
    post({
      type: "error",
      id: msg.type === "load" ? undefined : msg.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
