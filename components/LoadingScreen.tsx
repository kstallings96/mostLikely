"use client";

import { useEffect, useState } from "react";
import type { ModelState } from "@/lib/useSpinnerModel";
import Wheel from "./Wheel";

export default function LoadingScreen({ state }: { state: ModelState | null }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(performance.now()), 500);
    return () => clearInterval(t);
  }, []);

  if (state?.status === "error") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <p className="text-6xl">😵‍💫</p>
        <h1 className="text-4xl font-bold">The spinner got stuck.</h1>
        <p className="text-2xl text-muted">Ask your teacher for help.</p>
        <button
          onClick={() => location.reload()}
          className="rounded-2xl bg-brand px-8 py-4 text-2xl font-bold text-white"
        >
          Try again ↻
        </button>
        <p className="max-w-xl font-mono text-sm text-muted">{state.message}</p>
      </main>
    );
  }

  const loading = state?.status === "loading" ? state : null;
  const frac = loading && loading.total ? loading.loaded / loading.total : 0;
  const seconds = loading && now ? Math.max(0, Math.round((now - loading.startedAt) / 1000)) : 0;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center" aria-live="polite">
      <Wheel spinning className="h-40 w-40" />
      <h1 className="text-4xl font-bold">Building your word spinner…</h1>
      {loading?.mode !== "server" && (
        <div className="h-6 w-full max-w-xl overflow-hidden rounded-full border-2 border-line bg-card">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${frac * 100}%` }} />
        </div>
      )}
      <p className="text-xl text-muted">
        {loading?.mode === "server" ? "Almost ready…" : "The first time takes a minute. Next time is fast!"}{" "}
        {seconds > 0 && <span>({seconds}s)</span>}
      </p>
      {loading && loading.total > 0 && (
        <p className="text-base text-muted">
          {(loading.loaded / 1e6).toFixed(0)} of {(loading.total / 1e6).toFixed(0)} MB
        </p>
      )}
    </main>
  );
}
