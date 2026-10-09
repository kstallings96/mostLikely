/**
 * Scoring for the rounds. Always judged on actual spins, never on the
 * chance bars. Pass chances are computed exactly from the sentence's spinner
 * and used only for the "Lucky win!" and "So close!" messages.
 */
import { GAME, type RoundConfig } from "@/config/game";
import { binomialAtLeast, bothInRange } from "./stats";

export interface Outcome {
  passed: boolean;
  /** How many times each target word came up. */
  targetCounts: Record<string, number>;
}

export function judge(round: RoundConfig, counts: Record<string, number>): Outcome {
  const targetCounts = Object.fromEntries(round.targets.map((t) => [t, counts[t] ?? 0]));
  switch (round.kind) {
    case "tutorial":
    case "sandbox":
      return { passed: false, targetCounts };
    case "atLeast":
    case "switch":
      return { passed: targetCounts[round.targets[0]] >= (round.min ?? round.spins), targetCounts };
    case "balance":
      return {
        passed: round.targets.every((t) => targetCounts[t] >= round.eachMin! && targetCounts[t] <= round.eachMax!),
        targetCounts,
      };
  }
}

/**
 * Exact chance that one set of spins passes, given each target word's chance
 * on this sentence's spinner. Null for the tutorial and Sandbox.
 */
export function passChance(round: RoundConfig, chanceOf: (word: string) => number): number | null {
  switch (round.kind) {
    case "tutorial":
    case "sandbox":
      return null;
    case "atLeast":
    case "switch":
      return binomialAtLeast(round.spins, round.min ?? round.spins, chanceOf(round.targets[0]));
    case "balance": {
      const [a, b] = round.targets;
      return bothInRange(round.spins, chanceOf(a), chanceOf(b), round.eachMin!, round.eachMax!);
    }
  }
}

export type Luck = "lucky" | "unlucky" | null;

/** Passed against the odds → "lucky"; missed with a good sentence → "unlucky". */
export function luck(passed: boolean, chance: number | null): Luck {
  if (chance === null) return null;
  if (passed && chance < GAME.luckyThreshold) return "lucky";
  if (!passed && chance >= GAME.unluckyThreshold) return "unlucky";
  return null;
}

/** Guess buttons go up by 1 for small sets, by 5 or 10 for big ones. */
export function guessStep(spins: number): number {
  return spins > 20 ? spins / 10 : 1;
}

/** "about 7 times in 10", or "almost never" / "almost every time". */
export function outOfTen(p: number): string {
  const n = Math.round(p * 10);
  if (n <= 0) return "less than 1 time in 10";
  if (n >= 10) return p >= 0.995 ? "almost every time" : "about 10 times in 10";
  return `about ${n} ${n === 1 ? "time" : "times"} in 10`;
}
