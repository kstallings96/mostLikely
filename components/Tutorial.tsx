"use client";

import { useEffect, useRef, useState } from "react";
import { GAME, type RoundConfig } from "@/config/game";
import { spokenText } from "@/lib/format";
import { logEvent } from "@/lib/logger";
import { countBy, type SpinResult } from "@/lib/sample";
import type { SpinnerBackend, SpinnerView } from "@/lib/spinner/types";
import { landingRotation } from "@/lib/wheel";
import SpinBoard from "./SpinBoard";
import SpinnerWheel from "./SpinnerWheel";

type Phase = "loading" | "look" | "spinning" | "first" | "done" | "error";

/**
 * "How it works": ready-made sentences, the AI's real spinner for each, and
 * 10 slow-motion spins that drop into the graph one at a time. Shows how
 * the chances (slices) turn into results (the graph).
 */
export default function Tutorial({
  model,
  round,
  onDone,
}: {
  model: SpinnerBackend;
  round: RoundConfig;
  onDone: () => void;
}) {
  const sentences = round.sentences ?? [];
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [view, setView] = useState<SpinnerView | null>(null);
  const [results, setResults] = useState<SpinResult[] | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [ms, setMs] = useState(0);
  const [landed, setLanded] = useState<SpinResult | null>(null);
  const rotationRef = useRef(0);
  const fastRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sentence = sentences[idx];
  const last = idx === sentences.length - 1;

  // Load this sentence's spinner and draw its 10 spins up front.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const v = await model.view(sentence);
        const r = await model.spin(v, round.spins);
        if (!live) return;
        setView(v);
        setResults(r);
        setPhase("look");
      } catch {
        if (live) setPhase("error");
      }
    })();
    return () => {
      live = false;
    };
  }, [model, sentence, round.spins]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function later(fn: () => void, wait: number) {
    timers.current.push(setTimeout(fn, wait));
  }

  /** Spin the wheel to land on result i, then drop it into the graph. */
  function spinTo(i: number, stopAfter: number) {
    if (!view || !results) return;
    const first = idx === 0 ? GAME.tutorialFirstSpinMs : GAME.tutorialFirstSpinMs * 0.6;
    const d = fastRef.current ? 450 : Math.max(GAME.tutorialFastestSpinMs, first * Math.pow(0.75, i));
    const turns = d > 1500 ? 3 : d > 900 ? 2 : 1;
    rotationRef.current = landingRotation(view.bars, results[i].key, rotationRef.current, turns, Math.random);
    setMs(d);
    setRotation(rotationRef.current);
    setPhase("spinning");
    later(() => {
      setRevealed(i + 1);
      setLanded(results[i]);
      if (i + 1 >= stopAfter) {
        setPhase(i + 1 >= results.length ? "done" : "first");
        if (i + 1 >= results.length) {
          logEvent({
            round: round.id,
            event_type: "spin_set",
            sentence,
            spin_results: {
              spins: results.map((r) => ({ word: r.key, token: r.text, p: Math.round(r.p * 1e6) / 1e6 })),
              counts: countBy(results),
            },
            detail: { tutorial: true, sentence_number: idx + 1 },
          });
        }
      } else later(() => spinTo(i + 1, stopAfter), fastRef.current ? 120 : 350);
    }, d + 120);
  }

  function nextSentence() {
    timers.current.forEach(clearTimeout);
    fastRef.current = false;
    if (last) return onDone();
    setIdx(idx + 1);
    setPhase("loading");
    setView(null);
    setResults(null);
    setRevealed(0);
    setLanded(null);
  }

  const caption = captionFor(phase, idx, last, landed, results);

  return (
    <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="flex min-h-0 flex-col items-center gap-3">
        <p
          key={caption}
          className="min-h-16 w-full animate-pop rounded-2xl bg-brand-soft px-4 py-3 text-2xl font-bold leading-snug"
        >
          {caption}
        </p>
        <p className="w-full text-3xl">
          {sentence}{" "}
          <span className="font-bold text-brand">
            {landed && phase !== "look" ? (
              <span key={revealed} className="animate-pop inline-block">
                {spokenText(landed.key, landed.text)}
              </span>
            ) : (
              "___"
            )}
          </span>
        </p>
        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
          {view ? (
            <SpinnerWheel bars={view.bars} rotation={rotation} ms={ms} className="h-full max-h-[24rem] max-w-full" />
          ) : (
            <p className="text-xl text-muted">
              {phase === "error" ? "😅 The spinner hiccuped." : "Making the spinner…"}
            </p>
          )}
        </div>
        <div className="flex w-full gap-2">
          {phase === "look" && (
            <BigButton onClick={() => spinTo(0, idx === 0 ? 1 : round.spins)}>
              {idx === 0 ? "Spin once ▶" : `Spin ${round.spins} ▶`}
            </BigButton>
          )}
          {phase === "first" && (
            <BigButton onClick={() => spinTo(revealed, round.spins)}>Spin {round.spins - revealed} more ▶</BigButton>
          )}
          {phase === "spinning" && revealed > 0 && (
            <button
              onClick={() => (fastRef.current = true)}
              className="flex-1 rounded-2xl border-4 border-line bg-card py-3 text-2xl font-bold"
            >
              Faster ⏩
            </button>
          )}
          {(phase === "done" || phase === "error") && (
            <BigButton onClick={nextSentence}>
              {last || phase === "error" ? "Let’s play! ▶" : "New sentence ▶"}
            </BigButton>
          )}
        </div>
      </section>

      <section className="flex min-h-0 flex-col">
        <div className="min-h-0 flex-1 rounded-3xl border-4 border-line bg-card p-4">
          <SpinBoard
            results={results && revealed ? results : null}
            revealed={revealed}
            spins={round.spins}
            bars={view?.bars ?? null}
            hideWheel
          />
        </div>
      </section>
    </main>
  );
}

function BigButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 animate-pop rounded-2xl bg-sun py-4 text-3xl font-bold text-ink shadow-[0_6px_0_#c98500] active:translate-y-1 active:shadow-none"
    >
      {children}
    </button>
  );
}

function captionFor(
  phase: Phase,
  idx: number,
  last: boolean,
  landed: SpinResult | null,
  results: SpinResult[] | null,
): string {
  const say = (r: SpinResult) => `“${spokenText(r.key, r.text)}”`;
  switch (phase) {
    case "loading":
      return "Getting a sentence ready…";
    case "error":
      return "Let’s skip ahead and play!";
    case "look":
      return idx === 0
        ? "The AI turns its guesses into a spinner. Bigger slice = more likely word."
        : "New sentence, new spinner! Look at the slices.";
    case "spinning":
      return landed ? "Watch the graph grow. Big slices win a lot, but not every time." : "Spinning…";
    case "first":
      return `It landed on ${landed ? say(landed) : "a word"}! That word goes on the graph. →`;
    case "done": {
      // Describe what really happened: chance can make 10 out of 10.
      const counts = countBy(results ?? []);
      const kinds = Object.keys(counts).length;
      const [topKey] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [""];
      const top = results?.find((r) => r.key === topKey);
      if (idx === 0) {
        return kinds === 1 && top
          ? `All 10 landed on ${say(top)}! Huge slice. Small slices can still win sometimes.`
          : `Mostly ${top ? say(top) : "one word"}, but not every time! Big slices win a lot.`;
      }
      return `${kinds} different words this time! Smaller slices, more surprises.${last ? " Your turn!" : ""}`;
    }
  }
}
