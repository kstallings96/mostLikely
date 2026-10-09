"use client";

import { useState } from "react";
import { GAME, PLURALS, type RoundConfig } from "@/config/game";
import { findBlockedWords, makeBlockSet } from "@/lib/blocklist";
import { wordEditDistance } from "@/lib/editDistance";
import { chanceText, showToken, wordLabel } from "@/lib/format";
import { guessOptions } from "@/lib/guess";
import { logEvent } from "@/lib/logger";
import { OTHER_KEY } from "@/lib/normalize";
import { guessStep, judge, luck, outOfTen, passChance, type Luck, type Outcome } from "@/lib/rounds";
import { countBy, cryptoRng, type SpinResult } from "@/lib/sample";
import { chanceOf, topWords, type SpinnerBackend, type SpinnerView } from "@/lib/spinner/types";
import PeekPanel from "./PeekPanel";
import { PredictCount, PredictWord, type Prediction } from "./Predict";
import SpinBoard from "./SpinBoard";
import { useSpinAnimation } from "./useSpinAnimation";

const blockSet = makeBlockSet();

export interface RoundResult {
  roundId: string;
  passed: boolean;
  lucky: boolean;
  setsUsed: number;
  /** The sentence that passed (or the last one tried). */
  sentence: string | null;
  /** Switcheroo: fewest words changed in a passing sentence. */
  wordsChanged?: number;
}

type Step = "write" | "predict" | "ready" | "spinning" | "done";

interface SetResult {
  outcome: Outcome;
  chance: number | null;
  luck: Luck;
}

export default function RoundScreen({
  model,
  round,
  startSentence,
  onDone,
}: {
  model: SpinnerBackend;
  /** Any round except the tutorial. */
  round: RoundConfig;
  /** Typed in at the start (from round.startFrom), e.g. the Dog Trainer sentence. */
  startSentence?: string;
  onDone: (result: RoundResult) => void;
}) {
  const scored = round.kind !== "sandbox";
  const target = round.targets[0];

  const [intro, setIntro] = useState(scored);
  const [draft, setDraft] = useState(startSentence ?? "");
  const [sentence, setSentence] = useState("");
  const [view, setView] = useState<SpinnerView | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [step, setStep] = useState<Step>("write");
  const [thinking, setThinking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [hiccup, setHiccup] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [peek, setPeek] = useState(false);
  const [xray, setXray] = useState(false);

  const [setsUsed, setSetsUsed] = useState(0);
  const [misses, setMisses] = useState(0);
  const [lastSet, setLastSet] = useState<SetResult | null>(null);
  const [passed, setPassed] = useState(false);
  const [lucky, setLucky] = useState(false);
  const [passSentence, setPassSentence] = useState<string | null>(null);
  const [bestWords, setBestWords] = useState<number | undefined>(undefined);

  const budgetLeft = round.budget === null ? Infinity : round.budget - setsUsed;
  const roundOver = scored && (passed || budgetLeft <= 0);
  const showHint = scored && !passed && !!round.hint && misses >= GAME.missesBeforeHint;

  const anim = useSpinAnimation((results, skipped) => {
    setStep("done");
    const counts = countBy(results);
    let detail: Record<string, unknown> = { set: setsUsed };
    if (scored && view) {
      const outcome = judge(round, counts);
      const chance = passChance(round, (w) => chanceOf(view, w));
      const l = luck(outcome.passed, chance);
      setLastSet({ outcome, chance, luck: l });
      if (outcome.passed) {
        setPassed(true);
        setPassSentence(sentence);
        if (l === "lucky") setLucky(true);
        if (round.kind === "switch" && startSentence) {
          const n = wordEditDistance(startSentence, sentence);
          setBestWords((b) => (b === undefined ? n : Math.min(b, n)));
        }
      } else {
        setMisses((m) => m + 1);
        if (misses + 1 === GAME.missesBeforeHint && round.hint) {
          logEvent({ round: round.id, event_type: "hint_shown", sentence, detail: { hint: round.hint } });
        }
      }
      detail = { ...detail, target_counts: outcome.targetCounts, passed: outcome.passed, pass_chance: chance, luck: l };
    }
    logEvent({
      round: round.id,
      event_type: "spin_set",
      sentence,
      distribution: view ? topWords(view, 10) : null,
      prediction: prediction && "word" in prediction ? prediction : null,
      spin_results: {
        spins: results.map((r) => ({
          word: r.key,
          token: r.text,
          p: Math.round(r.p * 1e6) / 1e6,
          ...(r.pieces && { pieces: r.pieces }),
        })),
        counts,
        skipped_animation: skipped,
      },
      detail,
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
      setLastSet(null);
      anim.clear();
      setStep("predict");
      logEvent({
        round: round.id,
        event_type: "sentence_submitted",
        sentence: text,
        distribution: topWords(v, 10),
        ...(startSentence && {
          detail: { words_from_start: wordEditDistance(startSentence, text), start_sentence: startSentence },
        }),
      });
    } catch (err) {
      setHiccup(true);
      logEvent({
        round: round.id,
        event_type: "error",
        sentence: text,
        detail: { where: "view", message: String(err) },
      });
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
    setSetsUsed((n) => n + 1);
    setStep("spinning");
    try {
      anim.start(await model.spin(view, round.spins));
    } catch (err) {
      setHiccup(true);
      setStep("ready");
      setSetsUsed((n) => n - 1); // a hiccup doesn't cost a try
      logEvent({ round: round.id, event_type: "error", sentence, detail: { where: "spin", message: String(err) } });
    }
  }

  function editSentence() {
    setStep("write");
    setDraft(sentence);
    setPeek(false);
    setLastSet(null);
    anim.clear();
  }

  function togglePeek() {
    if (!peek && view) logEvent({ round: round.id, event_type: "peek", sentence, distribution: topWords(view, 10) });
    setPeek(!peek);
  }

  function finish() {
    onDone({
      roundId: round.id,
      passed,
      lucky,
      setsUsed,
      sentence: passSentence ?? (sentence || null),
      wordsChanged: bestWords,
    });
  }

  if (intro) {
    return <RoundIntro round={round} startSentence={startSentence} onGo={() => setIntro(false)} onSkip={finish} />;
  }

  const wordsFromStart = round.kind === "switch" && startSentence ? wordEditDistance(startSentence, draft) : null;
  const showNext = round.kind === "sandbox" ? setsUsed >= GAME.sandboxSetsBeforeNext : roundOver;
  const canSpinAgain = budgetLeft > 0;

  return (
    <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Left: goal, sentence, guess, spin, peek */}
      <section className="flex min-h-0 flex-col gap-3">
        <div className="flex items-center gap-3">
          <p className="flex-1 text-xl text-muted">{round.goal}</p>
          {round.budget !== null && <Tickets left={budgetLeft} total={round.budget} />}
        </div>

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
                  placeholder={round.kind === "sandbox" ? "My pet is a" : "Type a sentence"}
                  aria-label="Start of a sentence"
                  className="min-w-0 flex-1 border-b-4 border-brand bg-transparent px-1 py-2 text-3xl outline-none"
                />
                <span className="text-3xl font-bold text-muted">___</span>
              </div>
              {wordsFromStart !== null && (
                <p className="text-lg text-muted">
                  ✏️ Words changed: <b className="text-ink">{wordsFromStart}</b> (fewer is better)
                </p>
              )}
              {blocked && <p className="text-xl text-coral">🙂 Let’s try different words.</p>}
              {hiccup && <p className="text-xl text-coral">😅 The spinner hiccuped. Try again!</p>}
              {showHint && <Hint text={round.hint!} />}
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
                disabled={step === "spinning" || budgetLeft <= 0}
                className="rounded-xl border-2 border-line px-3 py-2 text-lg font-bold disabled:opacity-40"
              >
                ✏️ Change
              </button>
            </div>
          )}
        </div>

        {step === "predict" &&
          (scored ? (
            <PredictCount word={target} spins={round.spins} onPick={pickPrediction} />
          ) : (
            <PredictWord options={options} onPick={pickPrediction} />
          ))}

        {(step === "ready" || step === "done") && (
          <div className="flex flex-col gap-3">
            {hiccup && <p className="text-xl text-coral">😅 The spinner hiccuped. Try again!</p>}
            {step === "done" && anim.results && !scored && (
              <SandboxSummary results={anim.results} prediction={prediction} />
            )}
            {step === "done" && scored && lastSet && (
              <SetSummary
                round={round}
                set={lastSet}
                prediction={prediction}
                wordsChanged={
                  round.kind === "switch" && startSentence ? wordEditDistance(startSentence, sentence) : undefined
                }
                outOfSpins={!passed && budgetLeft <= 0}
              />
            )}
            {step === "done" && showHint && <Hint text={round.hint!} />}
            <ActionButtons
              step={step}
              spinLabel={`Spin ${round.spins}! 🎡`}
              onSpin={doSpin}
              onAgain={() => setStep("predict")}
              canSpinAgain={canSpinAgain}
              next={showNext ? (round.kind === "sandbox" ? "I’m ready for a challenge →" : "Next →") : null}
              onNext={finish}
              passed={passed}
            />
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
                    highlight={round.targets}
                    onToggleXray={() => {
                      logEvent({ round: round.id, event_type: "xray_toggle", sentence, detail: { on: !xray } });
                      setXray(!xray);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-base text-muted">👉 These chances are the slices of the spinner.</p>
                  <button onClick={togglePeek} className="text-lg text-muted underline">
                    Hide
                  </button>
                </div>
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
            highlight={round.targets}
            bars={view?.bars ?? null}
            realWheel={peek}
            goal={scored && round.kind !== "balance" ? round.min : undefined}
            preparing={step === "spinning" && !anim.results}
            onSkip={anim.skip}
          />
        </div>
      </section>
    </main>
  );
}

function Hint({ text }: { text: string }) {
  return <p className="animate-pop rounded-xl bg-sky-soft px-3 py-2 text-xl">💡 {text}</p>;
}

function Tickets({ left, total }: { left: number; total: number }) {
  return (
    <div className="flex shrink-0 items-center gap-1" aria-label={`${left} tries left`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`text-2xl ${i < left ? "" : "opacity-20 grayscale"}`}>
          🎟️
        </span>
      ))}
    </div>
  );
}

function RoundIntro({
  round,
  startSentence,
  onGo,
  onSkip,
}: {
  round: RoundConfig;
  startSentence?: string;
  onGo: () => void;
  onSkip: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-xl animate-pop flex-col items-center gap-5 rounded-3xl border-4 border-line bg-card p-10 text-center">
        <span className="text-7xl">{round.icon}</span>
        {round.bonus && <span className="rounded-full bg-sun px-3 py-1 font-bold">Bonus!</span>}
        <h2 className="text-5xl font-bold text-brand">{round.title}</h2>
        <p className="text-3xl leading-snug">{round.goal}</p>
        {startSentence && (
          <p className="text-xl text-muted">
            {round.kind === "switch" ? "Start with your sentence:" : `Will this still win with ${round.spins} spins?`}{" "}
            <b className="text-ink">“{startSentence} ___”</b>
          </p>
        )}
        {round.budget !== null && (
          <p className="text-xl text-muted">
            You have {round.budget} 🎟️ tries. Each try is {round.spins} spins.
          </p>
        )}
        <button
          autoFocus
          onClick={onGo}
          className="rounded-2xl bg-brand px-12 py-5 text-3xl font-bold text-white shadow-[0_6px_0_#3d2790] active:translate-y-1 active:shadow-none"
        >
          Let’s go! ▶
        </button>
        {round.bonus && (
          <button onClick={onSkip} className="text-lg text-muted underline">
            Skip the bonus and finish
          </button>
        )}
      </div>
    </main>
  );
}

function ActionButtons(props: {
  step: Step;
  spinLabel: string;
  onSpin: () => void;
  onAgain: () => void;
  canSpinAgain: boolean;
  next: string | null;
  onNext: () => void;
  passed: boolean;
}) {
  const big = "rounded-2xl py-5 text-3xl font-bold active:translate-y-1 active:shadow-none animate-pop";
  const small = "rounded-2xl border-4 py-3 text-2xl font-bold active:translate-y-1 animate-pop";
  if (props.step === "ready") {
    return (
      <button onClick={props.onSpin} className={`${big} bg-sun text-ink shadow-[0_6px_0_#c98500]`}>
        {props.spinLabel}
      </button>
    );
  }
  // After a set: moving on is the big button once the round is won or out of
  // tries; otherwise it's spinning again.
  const nextFirst = props.next && (props.passed || !props.canSpinAgain);
  const primary = nextFirst
    ? { label: props.next!, on: props.onNext }
    : props.canSpinAgain
      ? { label: "Spin again 🔁", on: props.onAgain }
      : null;
  const secondary = nextFirst
    ? props.canSpinAgain
      ? [{ label: "Spin again 🔁", on: props.onAgain }]
      : []
    : props.next
      ? [{ label: props.next, on: props.onNext }]
      : [];
  return (
    <div className="flex flex-col gap-2">
      {primary && (
        <button onClick={primary.on} className={`${big} bg-sun text-ink shadow-[0_6px_0_#c98500]`}>
          {primary.label}
        </button>
      )}
      {secondary.map((b) => (
        <button key={b.label} onClick={b.on} className={`${small} border-line bg-card`}>
          {b.label}
        </button>
      ))}
    </div>
  );
}

function SetSummary({
  round,
  set,
  prediction,
  wordsChanged,
  outOfSpins,
}: {
  round: RoundConfig;
  set: SetResult;
  prediction: Prediction | null;
  wordsChanged?: number;
  outOfSpins: boolean;
}) {
  const { outcome, chance } = set;
  const counts = outcome.targetCounts;
  const guess = prediction && "count" in prediction ? prediction.count : undefined;
  const actual = counts[round.targets[0]];
  const step = guessStep(round.spins);
  return (
    <div className="flex animate-pop flex-col gap-1 text-2xl">
      <p>
        {round.kind === "balance" ? (
          round.targets.map((t, i) => (
            <span key={t}>
              {i > 0 && " · "}“{t}” <b>{counts[t]}</b>
            </span>
          ))
        ) : (
          <>
            “{round.targets[0]}” came up <b>{actual}</b> of {round.spins}.
          </>
        )}
        {guess !== undefined && (
          <span className="text-xl text-muted">
            {" "}
            {Math.abs(guess - actual) * 2 < step || guess === actual
              ? "🎯 Great guess!"
              : `(You guessed ${step > 1 ? "about " : ""}${guess}.)`}
          </span>
        )}
      </p>
      {outcome.passed ? (
        <>
          <p className="font-bold text-mint">
            🎉 You did it!
            {wordsChanged !== undefined && ` You changed ${wordsChanged} ${wordsChanged === 1 ? "word" : "words"}.`}
          </p>
          {set.luck === "lucky" && chance !== null && (
            <p className="rounded-xl bg-sun-soft px-3 py-2 text-xl">
              🍀 <b>Lucky win!</b> This sentence wins {outOfTen(chance)}. Can you do it again?
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-xl">{needText(round)}</p>
          {set.luck === "unlucky" && chance !== null ? (
            <p className="rounded-xl bg-sky-soft px-3 py-2 text-xl">
              😮 <b>So close!</b> This sentence wins {outOfTen(chance)}. Spin again!
            </p>
          ) : (
            !outOfSpins && <p className="text-xl text-muted">✏️ Try changing your sentence.</p>
          )}
          {outOfSpins && <p className="text-xl font-bold">🎟️ That’s all your tries. Great work! Let’s keep going.</p>}
        </>
      )}
    </div>
  );
}

function needText(round: RoundConfig): string {
  if (round.kind === "balance") return `Need both between ${round.eachMin} and ${round.eachMax}.`;
  return `Need ${round.min} or more.`;
}

function SandboxSummary({ results, prediction }: { results: SpinResult[]; prediction: Prediction | null }) {
  const counts = countBy(results);
  const [topWord] = Object.entries(counts)
    .filter(([k]) => k !== OTHER_KEY)
    .sort((a, b) => b[1] - a[1])[0] ?? [OTHER_KEY, 0];
  if (prediction && "word" in prediction) {
    const n = counts[prediction.word] ?? 0;
    return (
      <p className="animate-pop text-2xl">
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
    <p className="animate-pop text-2xl">
      The spinner liked <b>{wordLabel(topWord)}</b> most this time.
    </p>
  );
}
