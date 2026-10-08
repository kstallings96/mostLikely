import { keyLabel, OTHER_KEY, END_KEY } from "./normalize";

/** Kid-friendly percent: "42%", "3%", "<1%". */
export function pct(p: number): string {
  if (p <= 0) return "0%";
  if (p < 0.01) return "<1%";
  return `${Math.round(p * 100)}%`;
}

/** Chance in kid terms: "12%", or "about 1 in 4,000" when under 1%. */
export function chanceText(p: number): string {
  if (p >= 0.01) return pct(p);
  if (p <= 0) return "almost zero";
  const n = 1 / p;
  const digits = Math.floor(Math.log10(n)) - 1;
  const rounded = Math.round(n / 10 ** digits) * 10 ** digits;
  return `about 1 in ${rounded.toLocaleString("en-US")}`;
}

/** Show a raw token so its spaces are visible: " dog" → "␣dog". */
export function showToken(text: string): string {
  return text.replace(/^ /, "␣").replace(/\n/g, "↵");
}

export const wordLabel = keyLabel;

/** What to say a spin "said": the word, or the raw piece for "other". */
export function spokenText(key: string, tokenText: string): string {
  if (key === OTHER_KEY) return tokenText.trim() || tokenText;
  if (key === END_KEY) return tokenText.trim() || "the end";
  return key;
}

/** Letters, spaces, hyphens and apostrophes only ("Mary-Kate", "D'Andre"). */
export function sanitizeFirstName(raw: string): string {
  return raw
    .replace(/[^\p{L} '’\-]/gu, "")
    .replace(/\s+/g, " ")
    .trimStart()
    .slice(0, 20);
}

/** One letter, uppercase. */
export function sanitizeInitial(raw: string): string {
  return (raw.match(/\p{L}/u)?.[0] ?? "").toUpperCase();
}
