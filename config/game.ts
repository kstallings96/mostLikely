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
  /** Tutorial: how long the first slow-motion spin takes (ms); later ones speed up. */
  tutorialFirstSpinMs: 2400,
  /** Tutorial: the fastest a slow-motion spin gets (ms). */
  tutorialFastestSpinMs: 600,
  /** Words to offer as guesses in the Sandbox prediction step. */
  sandboxGuessOptions: 4,
  /** Spin sets in the Sandbox before the "Ready for a challenge?" button shows. */
  sandboxSetsBeforeNext: 2,
  /** Missed tries in a round before its hint shows. */
  missesBeforeHint: 2,
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

export type RoundKind = "tutorial" | "sandbox" | "atLeast" | "switch" | "balance";

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
  /** Pass if target count ≥ this (atLeast / switch). */
  min?: number;
  /** balance: each target must land in [eachMin, eachMax]. */
  eachMin?: number;
  eachMax?: number;
  /** Start with the sentence from this round already typed in. */
  startFrom?: string;
  /** A tip shown after a few missed tries (grade-4 wording). */
  hint?: string;
  /** tutorial: the ready-made sentences to spin in slow motion. */
  sentences?: string[];
  /** Optional rounds are shown as "Bonus". */
  bonus?: boolean;
  /** Set false to leave a round out of the activity. */
  enabled?: boolean;
}

export const ROUNDS: RoundConfig[] = [
  {
    id: "tutorial",
    kind: "tutorial",
    title: "How it works",
    icon: "🔍",
    goal: "Watch the AI pick the next word.",
    targets: [],
    spins: 10,
    budget: null,
    // Likely-but-not-certain (teeth 87%), middling (jelly 30%), spread out.
    // Not dog or cat sentences, so the tutorial doesn't give away answers.
    sentences: ["I brush my", "Peanut butter and", "My favorite color is"],
  },
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
    goal: "Get “dog” 5 or more times out of 10.",
    targets: ["dog"],
    spins: 10,
    budget: 5,
    min: 5,
    hint: "The AI copies phrases people say a lot. What words often come right before “dog”?",
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
    min: 5,
    startFrom: "dog-trainer",
    hint: "Think of a phrase that often ends with “cat”.",
  },
  {
    id: "big-spin",
    kind: "atLeast",
    title: "Big Spin",
    icon: "🚀",
    goal: "Get “dog” 25 or more times out of 50.",
    targets: ["dog"],
    spins: 50,
    budget: 3,
    min: 25,
    startFrom: "dog-trainer",
    hint: "More spins means less luck. Make “dog” the biggest slice you can.",
  },
  {
    id: "mega-spin",
    kind: "atLeast",
    title: "Mega Spin",
    icon: "🌟",
    goal: "Get “dog” 50 or more times out of 100.",
    targets: ["dog"],
    spins: 100,
    budget: 3,
    min: 50,
    startFrom: "big-spin",
    hint: "More spins means less luck. Make “dog” the biggest slice you can.",
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
    enabled: false, // turned off: too hard for a first session
  },
];

/** The rounds kids actually play, in order. */
export const ACTIVE_ROUNDS = ROUNDS.filter((r) => r.enabled !== false);

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
