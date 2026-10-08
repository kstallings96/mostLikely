import { describe, expect, it } from "vitest";
import { makeBlockSet } from "@/lib/blocklist";
import { finishWord, needsFinishing, spinAndFinish, type FinishDeps } from "@/lib/finish";
import { buildVocabIndex, mergeDistribution } from "@/lib/merge";
import { countBy, mulberry32 } from "@/lib/sample";

// Tiny fake vocabulary. " D" + "ick" spells a blocked word; " D" + "uke" is fine.
const TEXTS = [" is", " D", "uke", ' "', "Max", '"', " dog", ".", "ick"];
const T = Object.fromEntries(TEXTS.map((t, i) => [t, i]));

function oneHot(entries: [string, number][]): Float32Array {
  const p = new Float32Array(TEXTS.length);
  for (const [t, v] of entries) p[T[t]] = v;
  return p;
}

// What comes after the last piece.
const NEXT: Record<string, [string, number][]> = {
  " D": [["uke", 0.5], ["ick", 0.5]],
  uke: [[".", 1]],
  ick: [[".", 1]],
  ' "': [["Max", 1]],
  Max: [['"', 1]],
};

const deps: FinishDeps = {
  next: async (ids) => oneHot(NEXT[TEXTS[ids[ids.length - 1]]] ?? [[".", 1]]),
  texts: TEXTS,
  mask: new Uint8Array(TEXTS.length),
  blockSet: makeBlockSet(["dick"]),
  plurals: {},
};

const dist = mergeDistribution(oneHot([[" D", 0.5], [' "', 0.3], [" dog", 0.2]]), buildVocabIndex(TEXTS, {}), deps.mask);

describe("needsFinishing", () => {
  it("finishes word starts and opening quotes", () => {
    for (const t of [" D", " st", ' "', " '", " ("]) expect(needsFinishing(t)).toBe(true);
  });
  it("leaves whole words, punctuation, and mid-word pieces alone", () => {
    for (const t of [" dog", " a", " is", ".", ",", "uke", " 7"]) expect(needsFinishing(t)).toBe(false);
  });
});

describe("finishWord", () => {
  it("follows an opening quote to the word inside it", async () => {
    const f = await finishWord([T[" is"]], T[' "'], 0.3, deps, mulberry32(1));
    expect(f.pieces).toEqual([' "', "Max"]);
    expect(f.word).toBe("max");
    expect(f.p).toBeCloseTo(0.3);
  });
  it("multiplies the chances of each piece", async () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 20; i++) {
      const f = await finishWord([T[" is"]], T[" D"], 0.5, deps, rng);
      expect(f.pieces).toHaveLength(2);
      expect(f.p).toBeCloseTo(0.25);
    }
  });
});

describe("spinAndFinish", () => {
  it("turns word starts into finished words", async () => {
    const results = await spinAndFinish(dist, [T[" is"]], 300, mulberry32(5), deps);
    const counts = countBy(results);
    expect(Object.keys(counts).sort()).toEqual(["dog", "duke", "max"]);
    expect(results.find((r) => r.key === "duke")?.pieces).toEqual([" D", "uke"]);
    expect(results.find((r) => r.key === "dog")?.pieces).toBeUndefined();
  });
  it("never finishes into a blocked word, and rescales the rest", async () => {
    const results = await spinAndFinish(dist, [T[" is"]], 2000, mulberry32(8), deps);
    const counts = countBy(results);
    expect(counts.dick).toBeUndefined();
    // Blocking " D"+"ick" (0.25) leaves duke 0.25, max 0.3, dog 0.2 → rescaled by 0.75.
    expect(counts.duke / 2000).toBeCloseTo(0.25 / 0.75, 1);
    expect(counts.max / 2000).toBeCloseTo(0.3 / 0.75, 1);
    expect(counts.dog / 2000).toBeCloseTo(0.2 / 0.75, 1);
  });
});
