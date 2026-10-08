"use client";

import { useState } from "react";
import { PLURALS } from "@/config/game";
import { findBlockedWords, makeBlockSet } from "@/lib/blocklist";
import { wordLabel } from "@/lib/format";
import { toKidWord, wordsOf } from "@/lib/normalize";

export type Prediction =
  | { word: string; count?: number; custom?: boolean; chance?: number; pieces?: string[] }
  | { skipped: true };

const blockSet = makeBlockSet();

/**
 * "Which word will win?" — tap a word, or type your own ("fido").
 * No wrong answers.
 */
export function PredictWord({
  options,
  onPick,
}: {
  options: string[];
  onPick: (p: Prediction) => void;
}) {
  const [own, setOwn] = useState("");
  const [blocked, setBlocked] = useState(false);

  function submitOwn() {
    const word = wordsOf(own)[0];
    if (!word) return;
    if (findBlockedWords(word, blockSet, PLURALS).length) {
      setBlocked(true);
      return;
    }
    onPick({ word: toKidWord(word, PLURALS), custom: true });
  }

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
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submitOwn();
        }}
      >
        <input
          value={own}
          maxLength={24}
          onChange={(e) => {
            setOwn(e.target.value);
            setBlocked(false);
          }}
          placeholder="✏️ My own guess"
          aria-label="Type your own guess"
          className="min-w-0 flex-1 rounded-2xl border-4 border-line bg-card px-4 py-2 text-2xl outline-none focus:border-sky"
        />
        <button
          type="submit"
          disabled={!own.trim()}
          className="rounded-2xl bg-sky px-5 text-2xl font-bold text-white disabled:opacity-40"
        >
          Go
        </button>
      </form>
      {blocked && <p className="text-lg text-coral">🙂 Let’s try a different word.</p>}
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
