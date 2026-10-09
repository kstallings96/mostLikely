/**
 * GPT-2 next-word probabilities with transformers.js. Shared by the browser
 * worker and the Node check script.
 *
 * We use the BASE GPT-2 model (not a chat model) and read the raw logits at
 * the last position, then softmax them ourselves. No generate(), no
 * temperature, no top-k: the kids see the model's real spinner.
 */
import {
  AutoModelForCausalLM,
  AutoTokenizer,
  Tensor,
  type PreTrainedModel,
  type PreTrainedTokenizer,
  type ProgressCallback,
} from "@huggingface/transformers";

export const MODEL_ID = "Xenova/gpt2";

/**
 * fp16 (~250 MB) matches full precision almost exactly (total variation
 * distance ≈ 0.01). The 8-bit builds (~130–280 MB) are smaller but shift
 * probabilities by 0.2–0.4, which would teach kids the wrong numbers.
 * fp32 (~500 MB) is the fallback if fp16 fails to load.
 */
export const DTYPES = ["fp16", "fp32"] as const;
export type Dtype = (typeof DTYPES)[number];

export interface LoadedModel {
  tokenizer: PreTrainedTokenizer;
  model: PreTrainedModel;
  dtype: Dtype;
}

export async function loadGpt2({
  progress_callback,
  dtypes = DTYPES,
  device,
}: {
  progress_callback?: ProgressCallback;
  dtypes?: readonly Dtype[];
  /** "wasm" in the browser; leave unset in Node. */
  device?: "wasm";
} = {}): Promise<LoadedModel> {
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, { progress_callback });
  let lastError: unknown;
  for (const dtype of dtypes) {
    try {
      const model = await AutoModelForCausalLM.from_pretrained(MODEL_ID, {
        dtype,
        device,
        progress_callback,
      });
      return { tokenizer, model, dtype };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export function vocabSize({ model }: LoadedModel): number {
  return (model.config as unknown as { vocab_size: number }).vocab_size;
}

/** Decoded text of every token id, e.g. vocab[3290] === " dog". */
export function decodeVocab(tokenizer: PreTrainedTokenizer, size: number): string[] {
  const texts: string[] = new Array(size);
  for (let id = 0; id < size; id++) {
    texts[id] = tokenizer.decode([id], { clean_up_tokenization_spaces: false });
  }
  return texts;
}

/**
 * GPT-2 is sensitive to a trailing space ("my dog " predicts word pieces),
 * so we trim it. Kids should not be punished for an extra space.
 */
export function prepareText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Softmax over the logits at the last position: P(next token | text). */
export async function nextTokenProbs(lm: LoadedModel, text: string): Promise<Float32Array> {
  return probsAfterIds(lm, encodeText(lm, text));
}

/**
 * GPT-2's <|endoftext|> token. Training text was separated by it, so putting
 * it first tells the model "a new text starts here". Without it, sentence
 * openings get muddled guesses ("Once upon a" → "time" 18%; with it, 99%).
 */
export const GPT2_START = 50256;

export function encodeText(lm: LoadedModel, text: string): number[] {
  return [GPT2_START, ...lm.tokenizer.encode(prepareText(text))];
}

/** P(next token | these token ids). */
export async function probsAfterIds({ model }: LoadedModel, ids: number[]): Promise<Float32Array> {
  const input_ids = new Tensor("int64", BigInt64Array.from(ids.map(BigInt)), [1, ids.length]);
  const attention_mask = new Tensor("int64", new BigInt64Array(ids.length).fill(BigInt(1)), [1, ids.length]);
  const { logits } = await model({ input_ids, attention_mask });
  const [, seqLen, vocab] = logits.dims as number[];
  const data = logits.data as ArrayLike<number>;
  const off = (seqLen - 1) * vocab;

  let max = -Infinity;
  for (let i = 0; i < vocab; i++) max = Math.max(max, Number(data[off + i]));
  const probs = new Float32Array(vocab);
  let sum = 0;
  for (let i = 0; i < vocab; i++) {
    const e = Math.exp(Number(data[off + i]) - max);
    probs[i] = e;
    sum += e;
  }
  for (let i = 0; i < vocab; i++) probs[i] /= sum;
  logits.dispose?.();
  return probs;
}

/** Token ids for one word with its leading space, e.g. " Fido" → [" F", "ido"]. */
export function encodeWord(lm: LoadedModel, spaced: string): number[] {
  return lm.tokenizer.encode(spaced, { add_special_tokens: false });
}
