"use client";

import { useState } from "react";
import { sanitizeTeamCode } from "@/lib/format";
import type { ModelState } from "@/lib/useSpinnerModel";
import Wheel from "./Wheel";

export default function StartScreen({
  modelState,
  onStart,
}: {
  modelState: ModelState | null;
  onStart: (teamCode: string) => void;
}) {
  const [code, setCode] = useState("");
  const clean = code.trim();

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
          if (clean) onStart(clean);
        }}
      >
        <label className="text-left text-xl font-bold" htmlFor="team">
          Team name
        </label>
        <input
          id="team"
          autoFocus
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(sanitizeTeamCode(e.target.value))}
          placeholder="Table 3"
          className="rounded-2xl border-4 border-line bg-card px-5 py-4 text-3xl outline-none focus:border-brand"
        />
        <p className="text-left text-lg text-muted">🙈 No real names, please.</p>
        <button
          type="submit"
          disabled={!clean}
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
