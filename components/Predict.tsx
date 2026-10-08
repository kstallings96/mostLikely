"use client";

import { wordLabel } from "@/lib/format";

export type Prediction = { word: string; count?: number } | { skipped: true };

/** "Which word will come up most?" — tap a word. No wrong answers. */
export function PredictWord({
  options,
  onPick,
}: {
  options: string[];
  onPick: (p: Prediction) => void;
}) {
  return (
    <div className="flex flex-col gap-3 animate-pop">
      <p className="text-2xl font-bold">🤔 Which word will win?</p>
      <div className="grid grid-cols-2 gap-3">
        {options.map((w) => (
          <button
            key={w}
            onClick={() => onPick({ word: w })}
            className="min-h-16 rounded-2xl border-4 border-sky bg-sky-soft px-3 py-3 text-2xl font-bold text-ink transition hover:bg-sky hover:text-white active:scale-95"
          >
            {wordLabel(w)}
          </button>
        ))}
      </div>
      <button onClick={() => onPick({ skipped: true })} className="self-start text-lg text-muted underline">
        Not sure — just spin!
      </button>
    </div>
  );
}

/** "How many 'dog' out of 10?" — tap a number. */
export function PredictCount({
  word,
  spins,
  onPick,
}: {
  word: string;
  spins: number;
  onPick: (p: Prediction) => void;
}) {
  return (
    <div className="flex flex-col gap-3 animate-pop">
      <p className="text-2xl font-bold">
        🤔 How many <span className="text-brand">“{word}”</span> out of {spins}?
      </p>
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: spins + 1 }, (_, n) => (
          <button
            key={n}
            onClick={() => onPick({ word, count: n })}
            className="h-14 rounded-xl border-4 border-sky bg-sky-soft text-2xl font-bold transition hover:bg-sky hover:text-white active:scale-95"
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
