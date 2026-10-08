"use client";

import { ROUNDS } from "@/config/game";
import type { RoundResult } from "./RoundScreen";

/** The wrap-up: what each round showed, and the one big idea. */
export default function EndScreen({
  results,
  onKeepPlaying,
}: {
  results: Record<string, RoundResult>;
  onKeepPlaying: () => void;
}) {
  const scored = ROUNDS.filter((r) => r.kind !== "sandbox");
  return (
    <main className="flex flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="flex w-full max-w-3xl animate-pop flex-col gap-6 rounded-3xl border-4 border-line bg-card p-8">
        <h2 className="text-center text-5xl font-bold text-brand">🏆 You’re a spinner expert!</h2>

        <ul className="flex flex-col gap-2">
          {scored.map((r) => {
            const res = results[r.id];
            return (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-paper px-4 py-3 text-2xl">
                <span className="text-3xl">{r.icon}</span>
                <span className="flex-1 font-bold">{r.title}</span>
                <span className="text-xl">{resultText(r.id, res)}</span>
              </li>
            );
          })}
        </ul>

        <div className="rounded-2xl bg-brand-soft p-5 text-2xl leading-snug">
          <p className="font-bold">🎡 The AI spins for every word.</p>
          <p>Likely words come up often. Unlikely words come up sometimes.</p>
          <p>Your words change the spinner!</p>
        </div>

        <button
          onClick={onKeepPlaying}
          className="self-center rounded-2xl bg-sun px-10 py-4 text-2xl font-bold text-ink shadow-[0_6px_0_#c98500] active:translate-y-1 active:shadow-none"
        >
          Keep playing 🎡
        </button>
      </div>
    </main>
  );
}

function resultText(id: string, res: RoundResult | undefined): string {
  if (!res) return "Skipped";
  const parts: string[] = [res.lucky ? "🍀 Lucky win!" : res.passed ? "✅ Done!" : "👍 Good tries"];
  if (id === "switcheroo" && res.wordsChanged !== undefined) {
    parts.push(`${res.wordsChanged} ${res.wordsChanged === 1 ? "word" : "words"} changed`);
  }
  if (res.bigRun) parts.push(`${res.bigRun.count} of ${res.bigRun.total} in the big spin`);
  return parts.join(" · ");
}
