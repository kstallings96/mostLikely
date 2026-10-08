"use client";

import { useState } from "react";
import { sanitizeFirstName, sanitizeInitial } from "@/lib/format";
import type { ModelState } from "@/lib/useSpinnerModel";
import Wheel from "./Wheel";

export default function StartScreen({
  modelState,
  onStart,
}: {
  modelState: ModelState | null;
  onStart: (firstName: string, lastInitial: string) => void;
}) {
  const [first, setFirst] = useState("");
  const [initial, setInitial] = useState("");
  const ready = first.trim().length > 0 && initial.length === 1;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <Wheel className="h-28 w-28" />
        <h1 className="text-6xl font-bold text-brand">Most Likely</h1>
        <p className="text-2xl text-muted">What word comes next? Let’s spin!</p>
      </div>

      <form
        className="flex w-full max-w-md flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onStart(first.trim(), initial);
        }}
      >
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-left text-xl font-bold">
            First name
            <input
              id="first-name"
              autoFocus
              autoComplete="off"
              value={first}
              onChange={(e) => setFirst(sanitizeFirstName(e.target.value))}
              className="rounded-2xl border-4 border-line bg-card px-5 py-4 text-3xl font-normal outline-none focus:border-brand"
            />
          </label>
          <label className="flex w-36 flex-col gap-1 text-left text-xl font-bold">
            Last initial
            <input
              id="last-initial"
              autoComplete="off"
              value={initial}
              maxLength={1}
              onChange={(e) => setInitial(sanitizeInitial(e.target.value))}
              className="rounded-2xl border-4 border-line bg-card px-5 py-4 text-center text-3xl font-normal outline-none focus:border-brand"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={!ready}
          className="rounded-2xl bg-brand px-6 py-5 text-3xl font-bold text-white shadow-[0_6px_0_#3d2790] transition active:translate-y-1 active:shadow-none disabled:opacity-40"
        >
          Start ▶
        </button>
      </form>

      <ModelStatus state={modelState} />
    </main>
  );
}

function ModelStatus({ state }: { state: ModelState | null }) {
  if (!state || (state.status === "loading" && state.mode === "server")) {
    return <p className="text-sm text-muted">Getting the spinner ready…</p>;
  }
  if (state.status === "loading") {
    const frac = state.total ? state.loaded / state.total : 0;
    return (
      <div className="flex w-full max-w-md items-center gap-3 text-muted" aria-live="polite">
        <span className="text-sm">Getting the spinner ready</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-brand transition-all" style={{ width: `${frac * 100}%` }} />
        </div>
      </div>
    );
  }
  if (state.status === "ready") return <p className="text-mint">✓ Spinner ready</p>;
  return null;
}
