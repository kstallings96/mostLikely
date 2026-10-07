import { describe, expect, it } from "vitest";
import { buildVocabIndex, mergeDistribution } from "@/lib/merge";
import { countBy, mulberry32, sampleIndex, spin } from "@/lib/sample";
import { binomialAtLeast, binomialPmf, bothInRange } from "@/lib/stats";

describe("sampleIndex", () => {
  it("is reproducible with a seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const w = [1, 2, 3];
    expect(Array.from({ length: 20 }, () => sampleIndex(w, a))).toEqual(
      Array.from({ length: 20 }, () => sampleIndex(w, b)),
    );
  });
  it("never picks a zero-weight index", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 2000; i++) expect(sampleIndex([0, 1, 0, 1, 0], rng) % 2).toBe(1);
  });
  it("handles rng values right at the edge", () => {
    expect(sampleIndex([0.5, 0.5, 0], () => 0.9999999999)).toBe(1);
    expect(sampleIndex([0.5, 0.5], () => 0)).toBe(0);
  });
  it("matches the weights over many draws", () => {
    const rng = mulberry32(3);
    const n = 20000;
    const hits = [0, 0, 0];
    for (let i = 0; i < n; i++) hits[sampleIndex([0.7, 0.2, 0.1], rng)]++;
    expect(hits[0] / n).toBeCloseTo(0.7, 1);
    expect(hits[1] / n).toBeCloseTo(0.2, 1);
    expect(hits[2] / n).toBeCloseTo(0.1, 1);
  });
  it("throws on all-zero weights", () => {
    expect(() => sampleIndex([0, 0], mulberry32(1))).toThrow();
  });
});

describe("spin", () => {
  const index = buildVocabIndex([" dog", " dogs", " cat", "ite"], { dogs: "dog" });
  const dist = mergeDistribution([0.5, 0.2, 0.2, 0.1], index, new Uint8Array(4));

  it("samples from the merged distribution, not just the top word", () => {
    const counts = countBy(spin(dist, 10000, mulberry32(9)));
    expect(counts.dog / 10000).toBeCloseTo(0.7, 1);
    expect(counts.cat / 10000).toBeCloseTo(0.2, 1);
    expect(counts["(other)"] / 10000).toBeCloseTo(0.1, 1);
  });
  it("reports the raw token that came up and the word's chance", () => {
    const r = spin(dist, 50, mulberry32(2)).find((s) => s.key === "dog")!;
    expect([" dog", " dogs"]).toContain(r.text);
    expect(r.p).toBeCloseTo(0.7);
  });
});

describe("stats", () => {
  it("binomial pmf sums to 1", () => {
    let s = 0;
    for (let k = 0; k <= 10; k++) s += binomialPmf(10, k, 0.37);
    expect(s).toBeCloseTo(1, 10);
  });
  it("binomialAtLeast matches known values", () => {
    expect(binomialAtLeast(10, 10, 0.5)).toBeCloseTo(1 / 1024, 10);
    expect(binomialAtLeast(10, 0, 0.3)).toBeCloseTo(1, 10);
    expect(binomialAtLeast(10, 7, 0)).toBe(0);
  });
  it("bothInRange is 1 when the range covers every outcome", () => {
    expect(bothInRange(4, 0.5, 0.5, 0, 4)).toBeCloseTo(1, 10);
  });
  it("bothInRange is 0 when a word cannot appear", () => {
    expect(bothInRange(20, 0.5, 0, 7, 13)).toBe(0);
  });
});
