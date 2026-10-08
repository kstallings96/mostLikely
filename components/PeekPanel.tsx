"use client";

import { GAME } from "@/config/game";
import { pct, showToken, wordLabel } from "@/lib/format";
import { displayBars, type MergedDist } from "@/lib/merge";
import { OTHER_KEY, OTHER_WORDS_KEY } from "@/lib/normalize";

/** The spinner's chances for this sentence. A peek, not the score. */
export default function PeekPanel({
  dist,
  xray,
  onToggleXray,
  highlight = [],
}: {
  dist: MergedDist;
  xray: boolean;
  onToggleXray: () => void;
  highlight?: string[];
}) {
  const bars = displayBars(dist, GAME.displayBars, GAME.xrayTokensPerBar);
  const max = Math.max(...bars.map((b) => b.p));

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xl font-bold">👀 The spinner’s chances</p>
        <button
          onClick={onToggleXray}
          aria-pressed={xray}
          className={`rounded-xl border-2 px-3 py-1 text-lg font-bold ${
            xray ? "border-ink bg-ink text-white" : "border-line bg-card"
          }`}
        >
          🩻 X-ray {xray ? "on" : "off"}
        </button>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {bars.map((b) => {
          const target = highlight.includes(b.key);
          const pieces = b.key === OTHER_KEY;
          const otherWords = b.key === OTHER_WORDS_KEY;
          return (
            <li key={b.key} className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className={`w-40 shrink-0 truncate text-lg ${target ? "font-bold text-mint" : ""}`}>
                  {wordLabel(b.key)}
                </span>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-line/60">
                  <div
                    className="h-full rounded-md"
                    style={{
                      width: `${Math.max(1, (b.p / max) * 100)}%`,
                      background: target ? "#12a37f" : pieces ? "#9aa1ad" : otherWords ? "#a99be0" : "#5b3cc4",
                    }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-lg font-bold">{pct(b.p)}</span>
              </div>
              {xray && (
                <div className="mb-1 ml-40 flex flex-wrap gap-1 pl-2">
                  {b.tokens.map((t) => (
                    <code key={t.id} className="rounded bg-ink/5 px-1.5 text-sm">
                      {showToken(t.text)} <span className="text-muted">{pct(t.p)}</span>
                    </code>
                  ))}
                  {b.tokenCount > b.tokens.length && (
                    <span className="text-sm text-muted">+{(b.tokenCount - b.tokens.length).toLocaleString()} more</span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {xray && <p className="text-sm text-muted">␣ = a space. The AI sees word pieces, not words!</p>}
    </div>
  );
}
