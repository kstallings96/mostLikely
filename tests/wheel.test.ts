import { describe, expect, it } from "vitest";
import type { MergedEntry } from "@/lib/merge";
import { OTHER_KEY, OTHER_WORDS_KEY } from "@/lib/normalize";
import { mulberry32 } from "@/lib/sample";
import { colorFor, landingRotation, sliceKeyFor, slicesFor } from "@/lib/wheel";

const bar = (key: string, p: number): MergedEntry => ({ key, p, tokens: [], tokenCount: 1 });
const BARS = [bar("dog", 0.5), bar("cat", 0.25), bar(OTHER_WORDS_KEY, 0.15), bar(OTHER_KEY, 0.1)];

/** The wheel angle under the pointer after rotating by `r`. */
const under = (r: number) => (((360 - r) % 360) + 360) % 360;

describe("wheel", () => {
  it("sizes slices by chance", () => {
    const s = slicesFor(BARS);
    expect(s[0]).toMatchObject({ key: "dog", start: 0, end: 180 });
    expect(s[1]).toMatchObject({ key: "cat", start: 180, end: 270 });
    expect(s[3].end).toBeCloseTo(360);
  });
  it("lands the pointer inside the right slice", () => {
    const rng = mulberry32(1);
    let r = 0;
    for (const key of ["cat", "dog", "cat", "bear", ",", "dog"]) {
      r = landingRotation(BARS, key, r, 2, rng);
      const slice = slicesFor(BARS).find((s) => s.key === sliceKeyFor(key, BARS))!;
      const a = under(r);
      expect(a).toBeGreaterThan(slice.start);
      expect(a).toBeLessThan(slice.end);
    }
  });
  it("always turns forward by at least the requested turns", () => {
    const r = landingRotation(BARS, "dog", 100, 3, () => 0.5);
    expect(r - 100).toBeGreaterThanOrEqual(3 * 360);
    expect(r - 100).toBeLessThan(4 * 360);
  });
  it("sends unlisted words to other words and punctuation to pieces", () => {
    expect(sliceKeyFor("bear", BARS)).toBe(OTHER_WORDS_KEY);
    expect(sliceKeyFor(OTHER_KEY, BARS)).toBe(OTHER_KEY);
    expect(sliceKeyFor("(sentence ends)", BARS)).toBe(OTHER_KEY);
  });
  it("gives a word the same color everywhere for one sentence", () => {
    expect(colorFor("dog", BARS)).toBe(colorFor("dog", BARS));
    expect(colorFor("dog", BARS)).not.toBe(colorFor("cat", BARS));
  });
});
