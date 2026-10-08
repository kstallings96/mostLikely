export type WorkerRequest =
  | { type: "load" }
  | { type: "encode"; id: number; text: string }
  | { type: "encodeWord"; id: number; spaced: string }
  | { type: "probsAfter"; id: number; ids: number[] };

export type WorkerResponse =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready"; vocab: string[]; dtype: string; loadMs: number }
  | { type: "result"; id: number; value: number[] | Float32Array }
  | { type: "error"; id?: number; message: string };
