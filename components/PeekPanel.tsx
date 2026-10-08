"use client";

import { GAME } from "@/config/game";
import { pct, showToken, wordLabel } from "@/lib/format";
import { displayBars, type MergedDist, type MergedEntry } from "@/lib/merge";
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
    <div className="flex h-full min-h-0 flex-col gap-2">
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
          return (
            <li key={b.key} className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className={`w-36 shrink-0 text-lg leading-tight break-words ${target ? "font-bold text-mint" : ""}`}>
                  {wordLabel(b.key)}
                </span>
                <div className="flex h-6 flex-1 overflow-hidden rounded-md bg-line/60">
                  {b.key === OTHER_WORDS_KEY ? (
                    <RainbowBar bar={b} max={max} />
                  ) : (
                    <div
                      className="h-full rounded-md"
                      style={{
                        width: `${Math.max(1, (b.p / max) * 100)}%`,
                        background: target ? "#12a37f" : b.key === OTHER_KEY ? "#9aa1ad" : "#5b3cc4",
                      }}
                    />
                  )}
                </div>
                <span className="w-12 shrink-0 text-right text-lg font-bold">{pct(b.p)}</span>
              </div>
              {b.key === OTHER_WORDS_KEY && !!b.partCount && (
                <p className="ml-36 pl-2 text-sm text-muted">
                  {b.partCount.toLocaleString()} different words, each a tiny slice
                </p>
              )}
              {xray && (
                <div className="mb-1 ml-36 flex flex-wrap gap-1 pl-2">
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

/**
 * "Other words" drawn as one slice per word, so kids can see it is many
 * different words, not one big one. Words too thin to draw become a band of
 * hairline rainbow stripes.
 */
function RainbowBar({ bar, max }: { bar: MergedEntry; max: number }) {
  const drawn = (bar.parts ?? []).filter((p) => p.p / max >= 0.004);
  const tail = bar.p - drawn.reduce((s, p) => s + p.p, 0);
  return (
    <>
      {drawn.map((part, i) => (
        <div
          key={part.key}
          title={`${part.key} ${pct(part.p)}`}
          className="h-full shrink-0 border-r border-white/80"
          style={{ width: `${(part.p / max) * 100}%`, background: `hsl(${(i * 47) % 360} 70% 58%)` }}
        />
      ))}
      {tail > 0 && (
        <div
          title="thousands more"
          className="h-full shrink-0"
          style={{
            width: `${(tail / max) * 100}%`,
            background:
              "repeating-linear-gradient(90deg, hsl(0 70% 62%) 0 1px, hsl(50 85% 55%) 1px 2px, hsl(140 55% 50%) 2px 3px, hsl(210 70% 60%) 3px 4px, hsl(280 60% 62%) 4px 5px, #fff 5px 6px)",
          }}
        />
      )}
    </>
  );
}
