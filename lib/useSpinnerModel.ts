"use client";

import { useSyncExternalStore } from "react";
import { SpinnerModel, type LoadInfo } from "./model/client";

export type ModelState =
  | { status: "loading"; loaded: number; total: number; startedAt: number }
  | { status: "ready"; info: LoadInfo }
  | { status: "error"; message: string };

// One model per page, shared across components and surviving React's
// development double-mount. Loading starts as soon as the page opens, so it
// overlaps with kids typing their team code.
let shared: SpinnerModel | null = null;
let state: ModelState | null = null;
const listeners = new Set<() => void>();

function setState(s: ModelState) {
  state = s;
  listeners.forEach((l) => l());
}

function ensureModel(): SpinnerModel {
  if (shared) return shared;
  const startedAt = performance.now();
  setState({ status: "loading", loaded: 0, total: 0, startedAt });
  shared = new SpinnerModel((loaded, total) =>
    setState({ status: "loading", loaded, total, startedAt }),
  );
  shared.ready.then(
    (info) => {
      console.info(`[most-likely] GPT-2 ${info.dtype} ready in ${(info.loadMs / 1000).toFixed(1)}s`);
      setState({ status: "ready", info });
    },
    (err: Error) => setState({ status: "error", message: err.message }),
  );
  return shared;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  ensureModel();
  return () => {
    listeners.delete(listener);
  };
}

export function useSpinnerModel(): { model: SpinnerModel | null; state: ModelState | null } {
  const s = useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  );
  return { model: s ? shared : null, state: s };
}
