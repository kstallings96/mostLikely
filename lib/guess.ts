/**
 * Picking the guess buttons for the Sandbox. GPT-2's top words are often
 * filler ("the", "a", "not"), which makes dull choices, so the buttons skip
 * filler and offer the most likely *interesting* words plus one long shot.
 * The Peek bars and the spins still show the filler honestly.
 */
import type { MergedDist } from "./merge";
import { END_KEY, OTHER_KEY } from "./normalize";
import type { Rng } from "./sample";

export const FILLER_WORDS = new Set(
  `a an the this that these those some any each every all no not
   and or but so if then than because as of to in on at by for from with
   into onto out up down over under about after before around through off
   is am are was were be been being has have had do does did will would
   can could should may might must just also very really too still even
   now here there when where what who whom which why how
   i me my mine you your yours he him his she her hers it its we us our
   they them their one ones own other another such more most much many
   named called being like only always never often usually probably
   actually definitely again back`.split(/\s+/),
);

export function isInterestingWord(key: string): boolean {
  return key !== END_KEY && key !== OTHER_KEY && !FILLER_WORDS.has(key) && !/^\d+$/.test(key);
}

/**
 * Up to `n` guess options: the top (n - 1) interesting words plus one long
 * shot from a little further down, shuffled. Falls back to any word if a
 * sentence has too few interesting ones.
 */
export function guessOptions(dist: MergedDist, n: number, rng: Rng): string[] {
  const words = dist.entries.map((e) => e.key).filter((k) => k !== OTHER_KEY && k !== END_KEY);
  const interesting = words.filter(isInterestingWord);
  const pool = interesting.length >= n ? interesting : [...interesting, ...words.filter((w) => !interesting.includes(w))];
  const picks = pool.slice(0, n - 1);
  const longShots = pool.slice(n - 1, n + 6);
  if (longShots.length) picks.push(longShots[Math.floor(rng() * longShots.length)]);
  for (let i = picks.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [picks[i], picks[j]] = [picks[j], picks[i]];
  }
  return picks;
}
