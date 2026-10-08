import { describe, expect, it } from "vitest";
import { END_KEY, OTHER_KEY, keyLabel, normalizeToken, tokenKey, wordsOf } from "@/lib/normalize";

const PLURALS = { dogs: "dog", mice: "mouse" };

describe("normalizeToken", () => {
  it("strips the leading space and lowercases", () => {
    expect(normalizeToken(" Dog")).toEqual({ kind: "word", word: "dog" });
  });
  it("drops attached punctuation", () => {
    expect(normalizeToken(' "dog')).toEqual({ kind: "word", word: "dog" });
    expect(normalizeToken(" dog,")).toEqual({ kind: "word", word: "dog" });
  });
  it("keeps inner apostrophes and hyphens", () => {
    expect(normalizeToken(" don't")).toEqual({ kind: "word", word: "don't" });
    expect(normalizeToken(" x-ray")).toEqual({ kind: "word", word: "x-ray" });
  });
  it("treats sentence-ending punctuation as the end", () => {
    for (const t of [".", "!", "?", " .", "...", '."', "!)", "\n", "\n\n", "<|endoftext|>"]) {
      expect(normalizeToken(t)).toEqual({ kind: "end" });
    }
  });
  it("treats stray single letters as fragments, but keeps a and I", () => {
    expect(normalizeToken(" p").kind).toBe("other");
    expect(normalizeToken(" I")).toEqual({ kind: "word", word: "i" });
    expect(normalizeToken(" a")).toEqual({ kind: "word", word: "a" });
    expect(normalizeToken(" 7")).toEqual({ kind: "word", word: "7" });
  });
  it("labels the leftover buckets so they can't be confused with real words", () => {
    expect(keyLabel(OTHER_KEY)).not.toBe(keyLabel(tokenKey(" other", PLURALS)));
  });
  it("sends fragments, commas, and odd bytes to other", () => {
    for (const t of ["ite", "s", ",", " ,", " -", " ", "\uFFFD", " ©", " café"]) {
      expect(normalizeToken(t).kind).toBe("other");
    }
  });
});

describe("tokenKey", () => {
  it("merges plurals from the map", () => {
    expect(tokenKey(" dogs", PLURALS)).toBe("dog");
    expect(tokenKey(" Mice", PLURALS)).toBe("mouse");
    expect(tokenKey(" cats", PLURALS)).toBe("cats"); // not in map → untouched
  });
  it("maps end and other to their keys", () => {
    expect(tokenKey(".", PLURALS)).toBe(END_KEY);
    expect(tokenKey("ite", PLURALS)).toBe(OTHER_KEY);
  });
});

describe("wordsOf", () => {
  it("splits, lowercases, and strips punctuation", () => {
    expect(wordsOf("  My DOG, is   big! ")).toEqual(["my", "dog", "is", "big"]);
  });
});
