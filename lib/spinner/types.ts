import type { MergedEntry } from "@/lib/merge";
import type { SpinResult } from "@/lib/sample";

/** What the UI needs to show one sentence's spinner. Small enough to send over the network. */
export interface SpinnerView {
  sentence: string;
  /** Peek bars, ready to draw (always sum to 1). */
  bars: MergedEntry[];
  /** Top merged entries (kid words, "(sentence ends)", pieces), high to low. */
  top: { key: string; p: number }[];
}

export interface WordChance {
  p: number;
  /** Token pieces for the word, e.g. [" F", "ido"]. */
  pieces: string[];
}

export interface LoadInfo {
  /** "server" or the browser model's precision ("fp16" / "fp32"). */
  dtype: string;
  loadMs: number;
}

/**
 * Where GPT-2 runs. "server": on the machine running `npm run dev`/`start`
 * (kids' laptops just show the page). "browser": in each kid's browser.
 */
export interface SpinnerBackend {
  readonly mode: "server" | "browser";
  readonly ready: Promise<LoadInfo>;
  view(text: string): Promise<SpinnerView>;
  spin(view: SpinnerView, n: number): Promise<SpinResult[]>;
  wordChance(text: string, word: string): Promise<WordChance>;
}

export function chanceOf(view: SpinnerView, key: string): number {
  return view.top.find((e) => e.key === key)?.p ?? 0;
}

export function topWords(view: SpinnerView, k: number): { word: string; p: number }[] {
  return view.top.slice(0, k).map((e) => ({ word: e.key, p: Math.round(e.p * 1e4) / 1e4 }));
}
