"use client";

import { GAME } from "@/config/game";
import { showToken, spokenText, wordLabel } from "@/lib/format";
import type { MergedEntry } from "@/lib/merge";
import { OTHER_KEY } from "@/lib/normalize";
import type { SpinResult } from "@/lib/sample";
import { colorFor, OTHER_WORDS_COLOR } from "@/lib/wheel";
import SpinnerWheel from "./SpinnerWheel";
import Wheel from "./Wheel";

/** Columns shown before the rest are grouped into "+N more". */
const MAX_COLUMNS = 8;
const MORE_KEY = "(more)";

export function isSurprise(r: SpinResult): boolean {
  return r.key !== OTHER_KEY && r.p < GAME.surpriseThreshold;
}

/**
 * Live graph: spins drop in one at a time and stack into columns. Up to 20
 * spins each spin is its own block; bigger sets grow solid bars. Columns keep
 * the order words first appeared so nothing jumps around mid-animation, and a
 * word's color matches its slice on the spinner and its Peek bar.
 */
export default function SpinBoard({
  results,
  revealed,
  spins,
  highlight = [],
  bars = null,
  realWheel = false,
  hideWheel = false,
  goal,
  preparing = false,
  onSkip,
}: {
  results: SpinResult[] | null;
  revealed: number;
  spins: number;
  /** Target words (labels shown bold). */
  highlight?: string[];
  /** The sentence's Peek bars, for matching colors. */
  bars?: MergedEntry[] | null;
  /** Show the sentence's real spinner (when Peek is open) instead of the toy wheel. */
  realWheel?: boolean;
  /** Hide the small wheel (the tutorial shows a big one). */
  hideWheel?: boolean;
  /** Draw a "goal" line at this many spins. */
  goal?: number;
  /** True while spins are being drawn (finishing words takes a moment). */
  preparing?: boolean;
  onSkip?: () => void;
}) {
  const smallWheel = (spin: boolean, cls: string) =>
    realWheel && bars ? (
      <SpinnerWheel bars={bars} labels={false} spinning={spin} className={cls} />
    ) : (
      <Wheel spinning={spin} className={cls} />
    );

  if (!results && preparing) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        {smallWheel(true, "h-24 w-24")}
        <p className="text-xl font-bold">Spinning…</p>
      </div>
    );
  }
  if (!results) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted">
        {!hideWheel && <Wheel className="h-24 w-24 opacity-30" />}
        <p className="text-xl">Spins show up here.</p>
      </div>
    );
  }

  const shown = results.slice(0, revealed);
  const spinning = revealed < results.length;
  const columns: { key: string; items: { r: SpinResult; i: number }[]; words?: number }[] = [];
  shown.forEach((r, i) => {
    let col = columns.find((c) => c.key === r.key);
    if (!col) {
      if (columns.length >= MAX_COLUMNS) {
        col = columns.find((c) => c.key === MORE_KEY);
        if (!col) columns.push((col = { key: MORE_KEY, items: [], words: 0 }));
        if (!col.items.some((x) => x.r.key === r.key)) col.words! += 1;
      } else columns.push((col = { key: r.key, items: [] }));
    }
    col.items.push({ r, i });
  });
  const latest = shown[shown.length - 1];
  const surprise = [...shown].reverse().find(isSurprise);
  const big = spins > 20;
  // Blocks shrink so a full column fits; the count label needs ~32px on top.
  const chipH = Math.max(10, Math.min(30, Math.floor(270 / spins)));
  // Big sets draw the goal inside each column (same scale as the bars).
  const goalBottom = goal === undefined || big ? null : `${goal * (chipH + 2)}px`;

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex min-h-14 items-center gap-3">
        {!hideWheel && smallWheel(spinning, "h-12 w-12 shrink-0")}
        <div className="flex-1 text-2xl">
          {latest && (
            <span key={revealed} className="inline-block animate-pop">
              Spin {revealed} of {results.length}:{" "}
              <b className={isSurprise(latest) ? "text-coral" : "text-brand"}>{spokenText(latest.key, latest.text)}</b>
              {latest.pieces && latest.pieces.length > 1 && (
                <span className="ml-2 text-base text-muted">({latest.pieces.map(showToken).join(" + ")})</span>
              )}
            </span>
          )}
        </div>
        {spinning && onSkip && (
          <button onClick={onSkip} className="rounded-xl border-2 border-line bg-card px-4 py-2 text-lg font-bold">
            Skip ⏩
          </button>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 items-end gap-2 overflow-x-auto border-b-4 border-ink/70 px-1 pt-8">
        {goalBottom && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 border-t-4 border-dashed border-mint"
            style={{ bottom: goalBottom }}
          >
            <span className="absolute -top-7 right-1 rounded bg-mint px-2 text-sm font-bold text-white">
              goal {goal}
            </span>
          </div>
        )}
        {columns.map((c, ci) => {
          const color = c.key === MORE_KEY ? OTHER_WORDS_COLOR : colorFor(c.key, bars, ci);
          return (
            <div
              key={c.key}
              className={`flex min-w-14 flex-1 flex-col items-center justify-end ${big ? "h-full" : ""}`}
              style={{ maxWidth: 120 }}
            >
              {big ? (
                <div className="relative w-full flex-1">
                  {goal !== undefined && (
                    <div
                      className="absolute inset-x-[-4px] z-10 border-t-4 border-dashed border-mint"
                      style={{ bottom: `${(goal / spins) * 100}%` }}
                    >
                      {ci === columns.length - 1 && (
                        <span className="absolute -top-7 right-0 whitespace-nowrap rounded bg-mint px-2 text-sm font-bold text-white">
                          goal {goal}
                        </span>
                      )}
                    </div>
                  )}
                  <span
                    className="absolute inset-x-0 text-center text-xl font-bold"
                    style={{ bottom: `calc(${(c.items.length / spins) * 100}% + 2px)` }}
                  >
                    {c.items.length}
                  </span>
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t-md transition-[height] duration-100"
                    style={{ height: `${(c.items.length / spins) * 100}%`, background: color }}
                  />
                </div>
              ) : (
                <>
                  <span className="mb-1 text-xl font-bold">{c.items.length}</span>
                  <div className="flex w-full flex-col-reverse gap-[2px]">
                    {c.items.map(({ r, i }) => (
                      <div
                        key={i}
                        title={(r.pieces ?? [r.text]).map(showToken).join(" + ")}
                        className={`animate-drop-in w-full rounded-md ${isSurprise(r) ? "ring-4 ring-sun" : ""}`}
                        style={{ height: chipH, background: color }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 overflow-x-auto px-1">
        {columns.map((c) => {
          const label = c.key === MORE_KEY ? `+${c.words} more` : wordLabel(c.key);
          return (
            <div
              key={c.key}
              className={`min-w-14 flex-1 text-center leading-tight text-balance hyphens-none ${
                label.length > 12 ? "text-sm" : "text-base"
              } ${highlight.includes(c.key) ? "font-bold text-ink underline decoration-4 decoration-mint" : ""}`}
              style={{ maxWidth: 120 }}
            >
              {label}
            </div>
          );
        })}
      </div>

      <div className="min-h-12">
        {surprise && (
          <p key={surprise.text + revealed} className="animate-pop rounded-xl bg-sun-soft px-4 py-2 text-xl">
            ✨ Whoa, it said <b>“{spokenText(surprise.key, surprise.text)}”</b>! That one was a long shot.
          </p>
        )}
      </div>
    </div>
  );
}
