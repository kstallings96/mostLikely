/**
 * Most Likely — game settings.
 *
 * Everything a researcher might want to tune lives here: target words,
 * thresholds, spin counts, budgets, and the short kid-facing text for each
 * round. Change values, save, and the dev server reloads. No other code needs
 * to change.
 */

export const GAME = {
  /** Spins in one normal set. */
  spinsPerSet: 10,
  /** How long the spin animation takes for a 10-spin set (ms). Skippable. */
  spinAnimationMs: 3000,
  /** A spun word under this chance gets a "Whoa!" highlight. */
  surpriseThreshold: 0.1,
  /**
   * "Lucky win!" badge: shown when a kid passes a round even though their
   * sentence's chance of passing (computed exactly from the spinner) was
   * below this.
   */
  luckyThreshold: 0.2,
  /**
   * "So close!" note: shown when a kid misses even though their sentence
   * passes at least this often. Spins are chance, so a good sentence can
   * still miss.
   */
  unluckyThreshold: 0.5,
  /** How many kid-word bars to show when peeking (everything else = "other"). */
  displayBars: 8,
  /** Raw tokens listed under each bar in X-ray mode. */
  xrayTokensPerBar: 8,
  /** Words to offer as guesses in the Sandbox prediction step. */
  sandboxGuessOptions: 4,
  /** Spin sets in the Sandbox before the "Ready for a challenge?" button shows. */
  sandboxSetsBeforeNext: 2,
};

/**
 * Plural → singular merges, for target words only (not a full lemmatizer).
 * Both sides must be single GPT-2 tokens with a leading space;
 * `npm run check-model` verifies this.
 */
export const PLURALS: Record<string, string> = {
  dogs: "dog",
  puppies: "puppy",
  cats: "cat",
  kittens: "kitten",
  mice: "mouse",
};

export type RoundKind = "sandbox" | "atLeast" | "switch" | "perfect" | "balance";

export interface RoundConfig {
  id: string;
  kind: RoundKind;
  /** Short title shown on the round card. */
  title: string;
  /** Emoji icon for the round. */
  icon: string;
  /** One-line goal, grade-4 reading level, under ~12 words. */
  goal: string;
  /** Word(s) that count for this round. */
  targets: string[];
  /** Spins per set for this round. */
  spins: number;
  /** Number of spin sets allowed (null = unlimited). */
  budget: number | null;
  /** Pass if target count ≥ this (atLeast / switch / perfect). */
  min?: number;
  /** balance: each target must land in [eachMin, eachMax]. */
  eachMin?: number;
  eachMax?: number;
  /** perfect: after passing, do one big run of this many spins. */
  bigSpins?: number;
  /** Optional rounds are shown as "Bonus". */
  bonus?: boolean;
}

export const ROUNDS: RoundConfig[] = [
  {
    id: "sandbox",
    kind: "sandbox",
    title: "Play",
    icon: "🎡",
    goal: "Type anything. Spin. See what comes next!",
    targets: [],
    spins: 10,
    budget: null,
  },
  {
    id: "dog-trainer",
    kind: "atLeast",
    title: "Dog Trainer",
    icon: "🐶",
    goal: "Get “dog” 7 or more times out of 10.",
    targets: ["dog"],
    spins: 10,
    budget: 5,
    min: 7,
  },
  {
    id: "switcheroo",
    kind: "switch",
    title: "Switcheroo",
    icon: "🐱",
    goal: "Change as few words as you can. Make “cat” win!",
    targets: ["cat"],
    spins: 10,
    budget: 5,
    min: 6,
  },
  {
    id: "perfect-10",
    kind: "perfect",
    title: "Perfect 10",
    icon: "💯",
    goal: "Get “dog” 10 out of 10. Then try 50!",
    targets: ["dog"],
    spins: 10,
    budget: 5,
    min: 10,
    bigSpins: 50,
  },
  {
    id: "coin-flip",
    kind: "balance",
    title: "Coin Flip",
    icon: "🪙",
    goal: "Make “dog” and “cat” tie. 20 spins.",
    targets: ["dog", "cat"],
    spins: 20,
    budget: 5,
    eachMin: 7,
    eachMax: 13,
    bonus: true,
  },
];

/** Every word the game depends on (used by the tokenizer check). */
export function allTargetWords(): string[] {
  const words = new Set<string>();
  for (const r of ROUNDS) r.targets.forEach((w) => words.add(w));
  for (const [plural, singular] of Object.entries(PLURALS)) {
    words.add(plural);
    words.add(singular);
  }
  return [...words];
}
