"use client";

import { GAME } from "@/config/game";
import { spokenText, wordLabel } from "@/lib/format";
import { OTHER_KEY } from "@/lib/normalize";
import type { SpinResult } from "@/lib/sample";
import Wheel from "./Wheel";

const COLORS = ["#5b3cc4", "#2d7ff9", "#12a37f", "#e4572e", "#c2410c", "#0e7490", "#9333ea", "#4d7c0f"];

export function isSurprise(r: SpinResult): boolean {
  return r.key !== OTHER_KEY && r.p < GAME.surpriseThreshold;
}

/**
 * Live histogram: spins drop in one at a time and stack into columns.
 * Columns keep the order words first appeared so nothing jumps around
 * mid-animation.
 */
export default function SpinBoard({
  results,
  revealed,
  spins,
  highlight = [],
  onSkip,
}: {
  results: SpinResult[] | null;
  revealed: number;
  spins: number;
  /** Words to color as targets (e.g. "dog"). */
  highlight?: string[];
  onSkip?: () => void;
}) {
  if (!results) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted">
        <Wheel className="h-24 w-24 opacity-30" />
        <p className="text-xl">Spins show up here.</p>
      </div>
    );
  }

  const shown = results.slice(0, revealed);
  const spinning = revealed < results.length;
  const columns: { key: string; items: { r: SpinResult; i: number }[] }[] = [];
  shown.forEach((r, i) => {
    let col = columns.find((c) => c.key === r.key);
    if (!col) columns.push((col = { key: r.key, items: [] }));
    col.items.push({ r, i });
  });
  const latest = shown[shown.length - 1];
  const surprise = [...shown].reverse().find(isSurprise);
  const big = spins > 20;
  // Leave room for the count label; chips shrink as spin sets get bigger.
  const chipH = Math.max(big ? 4 : 10, Math.min(30, Math.floor(270 / spins)));

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex min-h-14 items-center gap-3">
        <Wheel spinning={spinning} className="h-12 w-12 shrink-0" />
        <div className="flex-1 text-2xl">
          {latest && (
            <span key={revealed} className="inline-block animate-pop">
              Spin {revealed} of {results.length}:{" "}
              <b className={isSurprise(latest) ? "text-coral" : "text-brand"}>
                {spokenText(latest.key, latest.text)}
              </b>
            </span>
          )}
        </div>
        {spinning && onSkip && (
          <button onClick={onSkip} className="rounded-xl border-2 border-line bg-card px-4 py-2 text-lg font-bold">
            Skip ⏩
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 items-end gap-2 overflow-x-auto border-b-4 border-ink/70 px-1 pt-6">
        {columns.map((c, ci) => {
          const target = highlight.includes(c.key);
          const color = target ? "#12a37f" : COLORS[ci % COLORS.length];
          return (
            <div key={c.key} className="flex min-w-14 flex-1 flex-col items-center justify-end" style={{ maxWidth: 120 }}>
              <span className="mb-1 text-xl font-bold">{c.items.length}</span>
              <div className="flex w-full flex-col-reverse gap-[2px]">
                {c.items.map(({ r, i }) => (
                  <div
                    key={i}
                    title={r.text}
                    className={`animate-drop-in w-full rounded-md ${isSurprise(r) ? "ring-4 ring-sun" : ""}`}
                    style={{ height: chipH, background: color }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 overflow-x-auto px-1">
        {columns.map((c) => (
          <div
            key={c.key}
            className={`min-w-14 flex-1 text-center leading-tight text-balance hyphens-none ${
              wordLabel(c.key).length > 12 ? "text-sm" : "text-base"
            } ${
              highlight.includes(c.key) ? "font-bold text-mint" : ""
            }`}
            style={{ maxWidth: 120 }}
          >
            {wordLabel(c.key)}
          </div>
        ))}
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
