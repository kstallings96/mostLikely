"use client";

import { useSyncExternalStore } from "react";
import { BrowserBackend } from "./spinner/browser";
import { MODEL_MODE } from "./spinner/mode";
import { RemoteBackend } from "./spinner/remote";
import type { LoadInfo, SpinnerBackend } from "./spinner/types";

export type ModelState =
  | { status: "loading"; mode: "server" | "browser"; loaded: number; total: number; startedAt: number }
  | { status: "ready"; info: LoadInfo }
  | { status: "error"; message: string };

// One backend per page, shared across components and surviving React's
// development double-mount. Loading starts as soon as the page opens, so it
// overlaps with kids typing their team code.
let shared: SpinnerBackend | null = null;
let state: ModelState | null = null;
const listeners = new Set<() => void>();

function setState(s: ModelState) {
  state = s;
  listeners.forEach((l) => l());
}

function ensureModel(): SpinnerBackend {
  if (shared) return shared;
  const startedAt = performance.now();
  setState({ status: "loading", mode: MODEL_MODE, loaded: 0, total: 0, startedAt });
  shared =
    MODEL_MODE === "browser"
      ? new BrowserBackend((loaded, total) => setState({ status: "loading", mode: "browser", loaded, total, startedAt }))
      : new RemoteBackend();
  shared.ready.then(
    (info) => {
      console.info(`[most-likely] spinner ready (${info.dtype}) in ${(info.loadMs / 1000).toFixed(1)}s`);
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

export function useSpinnerModel(): { model: SpinnerBackend | null; state: ModelState | null } {
  const s = useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  );
  return { model: s ? shared : null, state: s };
}
