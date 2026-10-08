export type WorkerRequest =
  | { type: "load" }
  | { type: "predict"; id: number; text: string }
  | { type: "probsAfter"; id: number; ids: number[] }
  | { type: "wordChance"; id: number; text: string; word: string };

export type WorkerResponse =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready"; vocab: string[]; dtype: string; loadMs: number }
  | { type: "probs"; id: number; probs: Float32Array; ids?: number[] }
  | { type: "wordChance"; id: number; p: number; pieces: string[] }
  | { type: "error"; id?: number; message: string };
