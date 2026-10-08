"use client";

import { useState } from "react";
import { GAME, PLURALS, ROUNDS } from "@/config/game";
import { findBlockedWords, makeBlockSet } from "@/lib/blocklist";
import { logEvent } from "@/lib/logger";
import { guessOptions } from "@/lib/guess";
import { OTHER_KEY } from "@/lib/normalize";
import { countBy, cryptoRng, type SpinResult } from "@/lib/sample";
import { chanceOf, topWords, type SpinnerBackend, type SpinnerView } from "@/lib/spinner/types";
import { chanceText, showToken, wordLabel } from "@/lib/format";
import PeekPanel from "./PeekPanel";
import { PredictWord, type Prediction } from "./Predict";
import SpinBoard from "./SpinBoard";
import { useSpinAnimation } from "./useSpinAnimation";

const blockSet = makeBlockSet();
const SANDBOX = ROUNDS[0];

type Step = "write" | "predict" | "ready" | "spinning" | "done";

export default function PlayScreen({ model, teamCode }: { model: SpinnerBackend; teamCode: string }) {
  const round = SANDBOX;
  const [draft, setDraft] = useState("");
  const [sentence, setSentence] = useState("");
  const [view, setView] = useState<SpinnerView | null>(null);
  const [hiccup, setHiccup] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [step, setStep] = useState<Step>("write");
  const [thinking, setThinking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [peek, setPeek] = useState(false);
  const [xray, setXray] = useState(false);

  const anim = useSpinAnimation((results, skipped) => {
    setStep("done");
    logEvent({
      round: round.id,
      event_type: "spin_set",
      sentence,
      distribution: view ? topWords(view, 10) : null,
      prediction: prediction && "word" in prediction ? prediction : null,
      spin_results: {
        spins: results.map((r) => ({ word: r.key, token: r.text, ...(r.pieces && { pieces: r.pieces }) })),
        counts: countBy(results),
        skipped_animation: skipped,
      },
    });
  });

  async function submitSentence() {
    const text = draft.trim();
    if (!text || thinking) return;
    if (findBlockedWords(text, blockSet, PLURALS).length) {
      setBlocked(true);
      logEvent({ round: round.id, event_type: "sentence_blocked", sentence: text });
      return;
    }
    setBlocked(false);
    setHiccup(false);
    setThinking(true);
    try {
      const v = await model.view(text);
      setSentence(text);
      setView(v);
      setOptions(guessOptions(v.top, GAME.sandboxGuessOptions, cryptoRng));
      setPrediction(null);
      setPeek(false);
      anim.clear();
      setStep("predict");
      logEvent({ round: round.id, event_type: "sentence_submitted", sentence: text, distribution: topWords(v, 10) });
    } catch {
      setHiccup(true);
    } finally {
      setThinking(false);
    }
  }

  async function pickPrediction(p: Prediction) {
    // A typed guess: look up its chance, even if GPT-2 builds it from pieces.
    if ("word" in p && p.custom && view) {
      const merged = chanceOf(view, p.word);
      if (merged > 0) p = { ...p, chance: merged };
      else {
        try {
          const { p: chance, pieces } = await model.wordChance(sentence, p.word);
          p = { ...p, chance, pieces };
        } catch {
          // Not critical: the summary just leaves the chance out.
        }
      }
    }
    setPrediction(p);
    setStep("ready");
    if ("word" in p) logEvent({ round: round.id, event_type: "prediction", sentence, prediction: p });
  }

  async function doSpin() {
    if (!view) return;
    setHiccup(false);
    setStep("spinning");
    try {
      anim.start(await model.spin(view, round.spins));
    } catch {
      setHiccup(true);
      setStep("ready");
    }
  }

  function editSentence() {
    setStep("write");
    setPeek(false);
    anim.clear();
  }

  function togglePeek() {
    if (!peek && view) logEvent({ round: round.id, event_type: "peek", sentence, distribution: topWords(view, 10) });
    setPeek(!peek);
  }

  return (
    <div className="flex h-dvh min-h-[600px] flex-col">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b-2 border-line bg-card px-5">
        <span className="text-2xl font-bold text-brand">Most Likely</span>
        <span className="rounded-full bg-brand-soft px-3 py-1 text-lg font-bold">
          {round.icon} {round.title}
        </span>
        <span className="ml-auto text-lg text-muted">Team: {teamCode}</span>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Left: sentence, guess, spin, peek */}
        <section className="flex min-h-0 flex-col gap-4">
          <p className="text-xl text-muted">{round.goal}</p>

          <div className="rounded-3xl border-4 border-line bg-card p-4">
            {step === "write" ? (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitSentence();
                }}
              >
                <div className="flex items-baseline gap-2">
                  <input
                    autoFocus
                    value={draft}
                    maxLength={120}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setBlocked(false);
                    }}
                    placeholder="My pet is a"
                    aria-label="Start of a sentence"
                    className="min-w-0 flex-1 border-b-4 border-brand bg-transparent px-1 py-2 text-3xl outline-none"
                  />
                  <span className="text-3xl font-bold text-muted">___</span>
                </div>
                {blocked && <p className="text-xl text-coral">🙂 Let’s try different words.</p>}
                {hiccup && <p className="text-xl text-coral">😅 The spinner hiccuped. Try again!</p>}
                <button
                  type="submit"
                  disabled={!draft.trim() || thinking}
                  className="rounded-2xl bg-brand py-4 text-2xl font-bold text-white shadow-[0_5px_0_#3d2790] active:translate-y-1 active:shadow-none disabled:opacity-40"
                >
                  {thinking ? "Thinking…" : "Ready ✓"}
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-3">
                <p className="flex-1 text-3xl leading-snug">
                  {sentence} <span className="font-bold text-brand">___</span>
                </p>
                <button
                  onClick={editSentence}
                  disabled={step === "spinning"}
                  className="rounded-xl border-2 border-line px-3 py-2 text-lg font-bold disabled:opacity-40"
                >
                  ✏️ Change
                </button>
              </div>
            )}
          </div>

          {step === "predict" && <PredictWord options={options} onPick={pickPrediction} />}

          {(step === "ready" || step === "done") && (
            <div className="flex flex-col gap-3">
              {hiccup && <p className="text-xl text-coral">😅 The spinner hiccuped. Try again!</p>}
              {step === "done" && anim.results && (
                <SandboxSummary results={anim.results} prediction={prediction} />
              )}
              <button
                onClick={step === "ready" ? doSpin : () => setStep("predict")}
                className="rounded-2xl bg-sun py-5 text-3xl font-bold text-ink shadow-[0_6px_0_#c98500] active:translate-y-1 active:shadow-none animate-pop"
              >
                {step === "ready" ? `Spin ${round.spins}! 🎡` : "Spin again 🔁"}
              </button>
            </div>
          )}
          {view && step !== "write" && (
            <div className={`min-h-0 rounded-3xl border-4 border-line bg-card p-4 ${peek ? "flex-1" : ""}`}>
              {peek ? (
                <div className="flex h-full min-h-0 flex-col gap-1">
                  <div className="min-h-0 flex-1">
                    <PeekPanel
                      bars={view.bars}
                      xray={xray}
                      onToggleXray={() => {
                        logEvent({ round: round.id, event_type: "xray_toggle", sentence });
                        setXray(!xray);
                      }}
                    />
                  </div>
                  <button onClick={togglePeek} className="self-end text-lg text-muted underline">
                    Hide
                  </button>
                </div>
              ) : (
                <button
                  onClick={togglePeek}
                  disabled={step === "predict"}
                  className="w-full text-left text-xl font-bold disabled:opacity-40"
                >
                  👀 Peek at the chances
                </button>
              )}
            </div>
          )}
        </section>

        {/* Right: live results */}
        <section className="flex min-h-0 flex-col gap-3">
          <div className="min-h-0 flex-1 rounded-3xl border-4 border-line bg-card p-4">
            <SpinBoard
              results={anim.results}
              revealed={anim.revealed}
              spins={round.spins}
              preparing={step === "spinning" && !anim.results}
              onSkip={anim.skip}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function SandboxSummary({ results, prediction }: { results: SpinResult[]; prediction: Prediction | null }) {
  const counts = countBy(results);
  const [topWord] = Object.entries(counts)
    .filter(([k]) => k !== OTHER_KEY)
    .sort((a, b) => b[1] - a[1])[0] ?? [OTHER_KEY, 0];
  if (prediction && "word" in prediction) {
    const n = counts[prediction.word] ?? 0;
    return (
      <p className="text-2xl animate-pop">
        {prediction.word === topWord ? "🎯 " : "👍 "}You picked <b>{wordLabel(prediction.word)}</b>. It came up{" "}
        <b>{n}</b> {n === 1 ? "time" : "times"}!
        {prediction.custom && prediction.chance !== undefined && (
          <span className="mt-1 block text-xl text-muted">
            Its chance each spin: <b>{chanceText(prediction.chance)}</b>
            {prediction.pieces && prediction.pieces.length > 1 && (
              <span className="block text-lg">
                The AI builds “{prediction.word}” from {prediction.pieces.length} pieces:{" "}
                {prediction.pieces.map((piece, i) => (
                  <code key={i} className="mx-0.5 rounded bg-ink/5 px-1.5">
                    {showToken(piece)}
                  </code>
                ))}
              </span>
            )}
          </span>
        )}
      </p>
    );
  }
  return (
    <p className="text-2xl animate-pop">
      The spinner liked <b>{wordLabel(topWord)}</b> most this time.
    </p>
  );
}
