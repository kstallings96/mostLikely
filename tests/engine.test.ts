import { describe, expect, it } from "vitest";
import { SpinnerEngine } from "@/lib/spinner/engine";
import { chanceOf, topWords } from "@/lib/spinner/types";
import { mulberry32 } from "@/lib/sample";

// Fake model: vocab and next-token tables keyed by the last token.
const VOCAB = [" is", " dog", " F", "ido", " f", ".", " cat"];
const NEXT: Record<number, number[]> = {
  0: [0, 0.5, 0.2, 0, 0.1, 0.1, 0.1], // after " is"
  2: [0, 0, 0, 0.5, 0, 0.5, 0], //       after " F": "ido" half the time
  4: [0, 0, 0, 0.2, 0, 0.8, 0], //       after " f"
};

let calls = 0;
const engine = new SpinnerEngine({
  encode: async () => [0],
  encodeWord: async (spaced) => (spaced === " Fido" ? [2, 3] : spaced === " fido" ? [4, 3] : [1]),
  next: async (ids) => {
    calls++;
    return Float32Array.from(NEXT[ids[ids.length - 1]] ?? [0, 0, 0, 0, 0, 1, 0]);
  },
  vocab: VOCAB,
});

describe("SpinnerEngine", () => {
  it("builds a view with bars that sum to 1 and a top list", async () => {
    const view = await engine.view("my pet is");
    expect(view.bars.reduce((s, b) => s + b.p, 0)).toBeCloseTo(1);
    expect(chanceOf(view, "dog")).toBeCloseTo(0.5);
    expect(topWords(view, 1)).toEqual([{ word: "dog", p: 0.5 }]);
  });
  it("caches the model call for a sentence it has already seen", async () => {
    const before = calls;
    await engine.view("cached sentence");
    await engine.view("cached sentence");
    expect(calls - before).toBe(1);
  });
  it("chains piece chances for multi-piece words, summing spellings", async () => {
    const c = await engine.wordChance("my pet is", "fido");
    // " Fido": 0.2 × 0.5 = 0.10; " fido": 0.1 × 0.2 = 0.02
    expect(c.p).toBeCloseTo(0.12);
    expect(c.pieces).toEqual([" F", "ido"]);
  });
  it("finishes word starts when spinning", async () => {
    const spins = await engine.spin("my pet is", 400, mulberry32(4));
    const fido = spins.find((s) => s.key === "fido");
    expect(fido?.pieces).toEqual([" F", "ido"]);
  });
});
