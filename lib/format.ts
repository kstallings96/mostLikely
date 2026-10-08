import { keyLabel, OTHER_KEY, END_KEY } from "./normalize";

/** Kid-friendly percent: "42%", "3%", "<1%". */
export function pct(p: number): string {
  if (p <= 0) return "0%";
  if (p < 0.01) return "<1%";
  return `${Math.round(p * 100)}%`;
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

export function sanitizeTeamCode(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N} \-]/gu, "")
    .replace(/\s+/g, " ")
    .trimStart()
    .slice(0, 24);
}
