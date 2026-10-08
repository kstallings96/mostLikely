import { describe, expect, it } from "vitest";
import { END_KEY, OTHER_KEY } from "@/lib/normalize";
import { buildVocabIndex, displayBars, mergeDistribution, probOf, topK } from "@/lib/merge";

const PLURALS = { dogs: "dog", cats: "cat" };
const TEXTS = [" dog", " dogs", " Dog", " cat", ".", "ite", ",", " bear", " fish"];
const PROBS = [0.3, 0.1, 0.05, 0.2, 0.15, 0.05, 0.05, 0.06, 0.04];
const index = buildVocabIndex(TEXTS, PLURALS);
const none = new Uint8Array(TEXTS.length);

describe("mergeDistribution", () => {
  const dist = mergeDistribution(PROBS, index, none);

  it("sums tokens that share a kid word", () => {
    expect(probOf(dist, "dog")).toBeCloseTo(0.45);
    expect(probOf(dist, "cat")).toBeCloseTo(0.2);
    expect(probOf(dist, END_KEY)).toBeCloseTo(0.15);
    expect(probOf(dist, OTHER_KEY)).toBeCloseTo(0.1);
  });
  it("sorts entries high to low and sums to 1", () => {
    const ps = dist.entries.map((e) => e.p);
    expect([...ps].sort((a, b) => b - a)).toEqual(ps);
    expect(ps.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it("keeps the raw tokens behind each bar for X-ray", () => {
    const dog = dist.entries.find((e) => e.key === "dog")!;
    expect(dog.tokens.map((t) => t.text)).toEqual([" dog", " dogs", " Dog"]);
    expect(dog.tokenCount).toBe(3);
  });
  it("normalizes input that does not sum to 1", () => {
    const d = mergeDistribution(PROBS.map((p) => p * 3), index, none);
    expect(probOf(d, "dog")).toBeCloseTo(0.45);
  });
});

describe("displayBars", () => {
  const dist = mergeDistribution(PROBS, index, none);
  it("shows the top n and folds the rest into other", () => {
    const bars = displayBars(dist, 2);
    expect(bars.map((b) => b.key)).toEqual(["dog", "cat", OTHER_KEY]);
    expect(bars[2].p).toBeCloseTo(0.35); // end + other + bear + fish
    expect(bars.reduce((s, b) => s + b.p, 0)).toBeCloseTo(1);
  });
  it("can include (sentence ends) as a bar", () => {
    expect(displayBars(dist, 3).map((b) => b.key)).toContain(END_KEY);
  });
});

describe("topK", () => {
  it("rounds to 4 places for logs", () => {
    const t = topK(mergeDistribution(PROBS, index, none), 2);
    expect(t).toEqual([
      { word: "dog", p: 0.45 },
      { word: "cat", p: 0.2 },
    ]);
  });
});
