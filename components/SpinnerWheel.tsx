"use client";

import type { MergedEntry } from "@/lib/merge";
import { OTHER_WORDS_KEY } from "@/lib/normalize";
import { pct } from "@/lib/format";
import { colorFor, sliceLabel, slicesFor } from "@/lib/wheel";

/**
 * The sentence's real spinner: one slice per word, sized by its chance.
 * Controlled: the parent sets `rotation` (degrees) and how long the turn
 * takes (`ms`), so it can choose exactly where the wheel lands.
 */
export default function SpinnerWheel({
  bars,
  rotation = 0,
  ms = 0,
  labels = true,
  spinning = false,
  className = "",
}: {
  bars: MergedEntry[];
  rotation?: number;
  ms?: number;
  labels?: boolean;
  /** Free-spin animation (for the small wheel while results come in). */
  spinning?: boolean;
  className?: string;
}) {
  const slices = slicesFor(bars);
  return (
    <div className={`relative aspect-square ${className}`}>
      <div
        className={`h-full w-full ${spinning ? "animate-wheel" : ""}`}
        style={{
          transform: spinning ? undefined : `rotate(${rotation}deg)`,
          transition: ms ? `transform ${ms}ms cubic-bezier(0.12, 0.65, 0.18, 1)` : undefined,
        }}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="The AI's spinner for the next word">
          <defs>
            <pattern id="rainbow" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
              <rect width="0.6" height="3" fill="hsl(0 70% 62%)" />
              <rect x="0.6" width="0.6" height="3" fill="hsl(50 85% 55%)" />
              <rect x="1.2" width="0.6" height="3" fill="hsl(140 55% 50%)" />
              <rect x="1.8" width="0.6" height="3" fill="hsl(210 70% 60%)" />
              <rect x="2.4" width="0.6" height="3" fill="hsl(280 60% 62%)" />
            </pattern>
          </defs>
          {slices.map((s) => (
            <path
              key={s.key}
              d={arcPath(s.start, s.end)}
              fill={s.key === OTHER_WORDS_KEY ? "url(#rainbow)" : colorFor(s.key, bars)}
              stroke="#fff"
              strokeWidth="0.6"
            />
          ))}
          {labels &&
            slices
              .filter((s) => s.end - s.start >= 16)
              .map((s) => {
                const mid = (s.start + s.end) / 2;
                const [x, y] = point(mid, 30);
                return (
                  <text
                    key={s.key}
                    x={x}
                    y={y}
                    fontSize={s.end - s.start > 40 ? 5.5 : 4.2}
                    fontWeight="700"
                    fill="#fff"
                    stroke="#1d2433"
                    strokeWidth="0.35"
                    paintOrder="stroke"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    // Counter-rotate so the label lands upright wherever the wheel stops.
                    transform={`rotate(${-rotation} ${x} ${y})`}
                  >
                    {sliceLabel(s.key)} {pct(s.p)}
                  </text>
                );
              })}
          <circle cx="50" cy="50" r="6" fill="#fff" stroke="#1d2433" strokeWidth="0.8" />
        </svg>
      </div>
      {/* The pointer stays put; the wheel turns under it. */}
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <path d="M50 9 L44 -1 L56 -1Z" fill="#1d2433" stroke="#fff" strokeWidth="0.8" />
      </svg>
    </div>
  );
}

function point(deg: number, r: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [50 + r * Math.sin(rad), 50 - r * Math.cos(rad)];
}

function arcPath(start: number, end: number): string {
  if (end - start >= 359.99) return "M50 4 A46 46 0 1 1 49.99 4Z";
  const [x1, y1] = point(start, 46);
  const [x2, y2] = point(end, 46);
  return `M50 50 L${x1.toFixed(2)} ${y1.toFixed(2)} A46 46 0 ${end - start > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}Z`;
}
