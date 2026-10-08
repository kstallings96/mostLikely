/// <reference lib="webworker" />
/**
 * Browser mode only: runs GPT-2 off the main thread so the page stays
 * responsive while the model loads and thinks.
 *
 * Model files are looked for first at /models/Xenova/gpt2/ (put there by
 * `npm run fetch-model`), then on huggingface.co. After the first load the
 * browser keeps them in its cache.
 */
import { env } from "@huggingface/transformers";
import { decodeVocab, encodeText, encodeWord, loadGpt2, probsAfterIds, vocabSize, type LoadedModel } from "./core";
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
          if (p.status === "progress_total") post({ type: "progress", loaded: p.loaded, total: p.total });
        },
      });
      post({
        type: "ready",
        vocab: decodeVocab(lm.tokenizer, vocabSize(lm)),
        dtype: lm.dtype,
        loadMs: Math.round(performance.now() - t0),
      });
      return;
    }
    if (!lm) throw new Error("Model not loaded");
    if (msg.type === "encode") post({ type: "result", id: msg.id, value: encodeText(lm, msg.text) });
    else if (msg.type === "encodeWord") post({ type: "result", id: msg.id, value: encodeWord(lm, msg.spaced) });
    else if (msg.type === "probsAfter") {
      const probs = await probsAfterIds(lm, msg.ids);
      post({ type: "result", id: msg.id, value: probs }, [probs.buffer]);
    }
  } catch (err) {
    post({
      type: "error",
      id: msg.type === "load" ? undefined : msg.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
