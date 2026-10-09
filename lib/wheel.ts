/**
 * Geometry and colors for the real spinner wheel. A word gets the same
 * color as its wheel slice, its Peek bar, and its column in the spin graph,
 * so kids can follow chances → spinner → results.
 */
import type { MergedEntry } from "./merge";
import { END_KEY, OTHER_KEY, OTHER_WORDS_KEY } from "./normalize";

const PALETTE = ["#5b3cc4", "#2d7ff9", "#12a37f", "#e4572e", "#c2410c", "#0e7490", "#9333ea", "#4d7c0f", "#b45309"];
export const PIECES_COLOR = "#9aa1ad";
export const OTHER_WORDS_COLOR = "#a99be0";

/** The color for a word, given the sentence's Peek bars (null bars → by position). */
export function colorFor(key: string, bars: MergedEntry[] | null, fallbackIndex = 0): string {
  if (key === OTHER_KEY) return PIECES_COLOR;
  if (key === OTHER_WORDS_KEY) return OTHER_WORDS_COLOR;
  if (!bars) return PALETTE[fallbackIndex % PALETTE.length];
  const i = bars.findIndex((b) => b.key === key);
  // Words below the top few live in the rainbow "other words" slice.
  return i >= 0 ? PALETTE[i % PALETTE.length] : OTHER_WORDS_COLOR;
}

export interface Slice {
  key: string;
  p: number;
  /** Degrees clockwise from the top. */
  start: number;
  end: number;
}

export function slicesFor(bars: MergedEntry[]): Slice[] {
  const total = bars.reduce((s, b) => s + b.p, 0) || 1;
  let at = 0;
  return bars.map((b) => {
    const start = at;
    at += (b.p / total) * 360;
    return { key: b.key, p: b.p, start, end: at };
  });
}

/** Which slice a spin result belongs to (words below the top few → "other words"). */
export function sliceKeyFor(key: string, bars: MergedEntry[]): string {
  if (bars.some((b) => b.key === key)) return key;
  if (key === OTHER_KEY || key === END_KEY) return OTHER_KEY;
  return OTHER_WORDS_KEY;
}

/**
 * Wheel rotation (degrees) that lands the pointer (at the top) on a random
 * spot inside `key`'s slice, after `turns` full turns from `current`.
 */
export function landingRotation(
  bars: MergedEntry[],
  key: string,
  current: number,
  turns: number,
  rand: () => number,
): number {
  const slice = slicesFor(bars).find((s) => s.key === sliceKeyFor(key, bars));
  if (!slice) return current + turns * 360;
  const pad = (slice.end - slice.start) * 0.15;
  const spot = slice.start + pad + rand() * (slice.end - slice.start - 2 * pad);
  // The pointer is at 0°; rotating the wheel by R brings angle (360 - R) under it.
  const want = (360 - spot) % 360;
  const delta = (want - (((current % 360) + 360) % 360) + 360) % 360;
  return current + turns * 360 + delta;
}

/** Short labels that fit on a slice. */
export function sliceLabel(key: string): string {
  if (key === OTHER_KEY) return "pieces";
  if (key === OTHER_WORDS_KEY) return "other words";
  if (key === END_KEY) return "(end)";
  return key;
}
