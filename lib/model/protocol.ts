export type WorkerRequest =
  | { type: "load" }
  | { type: "predict"; id: number; text: string };

export type WorkerResponse =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready"; vocab: string[]; dtype: string; loadMs: number }
  | { type: "probs"; id: number; probs: Float32Array }
  | { type: "error"; id?: number; message: string };
