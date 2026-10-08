import { describe, expect, it } from "vitest";
import {
  applyBlockedMask,
  buildBlockedMask,
  findBlockedWords,
  makeBlockSet,
} from "@/lib/blocklist";
import { buildVocabIndex, mergeDistribution, probOf } from "@/lib/merge";
import { countBy, mulberry32, spin } from "@/lib/sample";
import { BLOCKLIST } from "@/config/blocklist";

const set = makeBlockSet(["badword", "ouch"]);

describe("findBlockedWords (kid input)", () => {
  it("finds blocked words regardless of case and punctuation", () => {
    expect(findBlockedWords("My BADWORD dog!", set)).toEqual(["badword"]);
    expect(findBlockedWords("ouch.", set)).toEqual(["ouch"]);
  });
  it("catches simple plurals", () => {
    expect(findBlockedWords("so many badwords", set)).toEqual(["badwords"]);
    expect(findBlockedWords("ouches", set)).toEqual(["ouches"]);
  });
  it("does not flag words that merely contain a blocked word", () => {
    expect(findBlockedWords("touchdown grouch", set)).toEqual([]);
  });
  it("loads the editable config list", () => {
    expect(makeBlockSet(BLOCKLIST).size).toBeGreaterThan(10);
  });
});

describe("blocking model output", () => {
  const texts = [" dog", " badword", "badword", " Badwords", " cat", "ouch"];
  const probs = [0.1, 0.4, 0.1, 0.1, 0.1, 0.2];
  const mask = buildBlockedMask(texts, set);

  it("flags every form of a blocked word, with or without a leading space", () => {
    expect([...mask]).toEqual([0, 1, 1, 1, 0, 1]);
  });
  it("zeroes blocked tokens and rescales the rest to 100%", () => {
    const safe = applyBlockedMask(probs, mask);
    expect(safe[1]).toBe(0);
    expect(safe[0]).toBeCloseTo(0.5);
    expect(safe[4]).toBeCloseTo(0.5);
    expect(safe.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it("never spins a blocked word, even when it was the favorite", () => {
    const dist = mergeDistribution(probs, buildVocabIndex(texts, {}), mask);
    expect(probOf(dist, "badword")).toBe(0);
    const counts = countBy(spin(dist, 5000, mulberry32(7)));
    expect(Object.keys(counts).sort()).toEqual(["cat", "dog"]);
  });
  it("throws if everything is blocked", () => {
    expect(() => applyBlockedMask([1], new Uint8Array([1]))).toThrow();
  });
});
