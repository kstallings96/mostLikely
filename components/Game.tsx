"use client";

import { useState } from "react";
import { ROUNDS } from "@/config/game";
import { logEvent } from "@/lib/logger";
import type { SpinnerBackend } from "@/lib/spinner/types";
import EndScreen from "./EndScreen";
import RoundScreen, { type RoundResult } from "./RoundScreen";

/**
 * The activity: Sandbox → Dog Trainer → Switcheroo → Perfect 10 → Coin Flip
 * (bonus) → the end. Add `?round=<id>` to the URL to start at a round (for
 * testing or a teacher demo).
 */
export default function Game({ model, player }: { model: SpinnerBackend; player: string }) {
  const [index, setIndex] = useState(() => {
    const id = new URLSearchParams(window.location.search).get("round");
    return Math.max(0, ROUNDS.findIndex((r) => r.id === id));
  });
  const [results, setResults] = useState<Record<string, RoundResult>>({});
  // Each visit to a round gets a fresh screen (e.g. Keep playing → Sandbox).
  const [visit, setVisit] = useState(0);
  const done = index >= ROUNDS.length;
  const round = ROUNDS[index];

  function finish(result: RoundResult) {
    if (round.kind !== "sandbox") {
      logEvent({
        round: round.id,
        event_type: "round_complete",
        sentence: result.sentence,
        words_changed: result.wordsChanged ?? null,
        detail: {
          passed: result.passed,
          lucky: result.lucky,
          sets_used: result.setsUsed,
          ...(result.bigRun && { big_run: result.bigRun }),
        },
      });
    }
    setResults((r) => ({ ...r, [round.id]: result }));
    goTo(round.bonus ? ROUNDS.length : index + 1);
  }

  function goTo(i: number) {
    setIndex(i);
    setVisit((v) => v + 1);
    if (i < ROUNDS.length) logEvent({ round: ROUNDS[i].id, event_type: "round_start" });
  }

  return (
    <div className="flex h-dvh min-h-[600px] flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b-2 border-line bg-card px-5">
        <span className="text-2xl font-bold text-brand">Most Likely</span>
        <nav className="flex gap-1" aria-label="Rounds">
          {ROUNDS.map((r, i) => {
            const res = results[r.id];
            const mark = res?.lucky ? "🍀" : res?.passed ? "✅" : res ? "•" : "";
            return (
              <span
                key={r.id}
                aria-current={i === index ? "step" : undefined}
                className={`rounded-full px-3 py-1 text-base font-bold ${
                  i === index ? "bg-brand text-white" : res ? "bg-mint-soft" : "bg-brand-soft/60 text-muted"
                }`}
              >
                {r.icon} {i === index && r.title} {mark}
              </span>
            );
          })}
        </nav>
        <span className="ml-auto text-lg text-muted">👋 {player}</span>
      </header>

      {done ? (
        <EndScreen
          results={results}
          onKeepPlaying={() => goTo(0)}
        />
      ) : (
        <RoundScreen
          key={`${round.id}-${visit}`}
          model={model}
          round={round}
          startSentence={round.kind === "switch" ? (results["dog-trainer"]?.sentence ?? undefined) : undefined}
          onDone={finish}
        />
      )}
    </div>
  );
}
