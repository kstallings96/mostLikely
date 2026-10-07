import { describe, expect, it } from "vitest";
import { wordEditDistance } from "@/lib/editDistance";

describe("wordEditDistance", () => {
  it("is 0 for the same sentence, ignoring case and punctuation", () => {
    expect(wordEditDistance("My pet is a", "my PET is a!")).toBe(0);
  });
  it("counts a swap as 1", () => {
    expect(wordEditDistance("The puppy barked at the", "The kitten barked at the")).toBe(1);
  });
  it("counts additions and deletions", () => {
    expect(wordEditDistance("I have a", "I have a fluffy")).toBe(1);
    expect(wordEditDistance("I really have a", "I have a")).toBe(1);
  });
  it("counts whole-sentence rewrites", () => {
    expect(wordEditDistance("a b c", "x y")).toBe(3);
    expect(wordEditDistance("", "one two")).toBe(2);
  });
  it("counts words, not letters", () => {
    expect(wordEditDistance("bark", "barks")).toBe(1);
  });
});
