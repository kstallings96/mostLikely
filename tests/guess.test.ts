import { describe, expect, it } from "vitest";
import { guessOptions, isInterestingWord } from "@/lib/guess";
import { buildVocabIndex, mergeDistribution } from "@/lib/merge";
import { mulberry32 } from "@/lib/sample";

const TEXTS = [" a", " the", ".", " jack", " john", " not", " charlie", " max", " leo", " my", "ite"];
const PROBS = [0.2, 0.18, 0.12, 0.06, 0.05, 0.05, 0.03, 0.02, 0.02, 0.05, 0.22];
const dist = mergeDistribution(PROBS, buildVocabIndex(TEXTS, {}), new Uint8Array(TEXTS.length));

describe("guessOptions", () => {
  it("skips filler, end, and pieces in favor of interesting words", () => {
    const opts = guessOptions(dist, 4, mulberry32(1));
    expect(opts).toHaveLength(4);
    expect(opts).toEqual(expect.arrayContaining(["jack", "john", "charlie"]));
    for (const o of opts) expect(isInterestingWord(o)).toBe(true);
  });
  it("falls back to any word when too few are interesting", () => {
    const d = mergeDistribution([0.5, 0.3, 0.2], buildVocabIndex([" the", " a", " dog"], {}), new Uint8Array(3));
    const opts = guessOptions(d, 4, mulberry32(2));
    expect(opts.sort()).toEqual(["a", "dog", "the"]);
  });
});
