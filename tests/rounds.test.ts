import { describe, expect, it } from "vitest";
import { ROUNDS } from "@/config/game";
import { judge, luck, outOfTen, passChance } from "@/lib/rounds";

const round = (id: string) => ROUNDS.find((r) => r.id === id)!;
const chances = (m: Record<string, number>) => (w: string) => m[w] ?? 0;

describe("judge", () => {
  it("Dog Trainer passes when dog wins at least half", () => {
    expect(judge(round("dog-trainer"), { dog: 5, cat: 3 }).passed).toBe(true);
    expect(judge(round("dog-trainer"), { dog: 4 }).passed).toBe(false);
    expect(judge(round("dog-trainer"), { cat: 9 }).targetCounts).toEqual({ dog: 0 });
  });
  it("Switcheroo needs cat to win at least half", () => {
    expect(judge(round("switcheroo"), { cat: 5, dog: 4 }).passed).toBe(true);
    expect(judge(round("switcheroo"), { cat: 4, dog: 6 }).passed).toBe(false);
  });
  it("Big Spin and Mega Spin keep the same goal with more spins", () => {
    expect(judge(round("big-spin"), { dog: 25, cat: 15 }).passed).toBe(true);
    expect(judge(round("big-spin"), { dog: 24 }).passed).toBe(false);
    expect(judge(round("mega-spin"), { dog: 50 }).passed).toBe(true);
    expect(judge(round("mega-spin"), { dog: 49 }).passed).toBe(false);
  });
  it("Coin Flip needs both words in range", () => {
    expect(judge(round("coin-flip"), { dog: 10, cat: 10 }).passed).toBe(true);
    expect(judge(round("coin-flip"), { dog: 7, cat: 13 }).passed).toBe(true);
    expect(judge(round("coin-flip"), { dog: 14, cat: 6 }).passed).toBe(false);
    expect(judge(round("coin-flip"), { dog: 10, cat: 5, bear: 5 }).passed).toBe(false);
  });
  it("the Sandbox has no pass or fail", () => {
    expect(judge(round("sandbox"), { dog: 10 }).passed).toBe(false);
  });
});

describe("passChance", () => {
  it("is exact for at-least rounds", () => {
    expect(passChance(round("dog-trainer"), chances({ dog: 0.5 }))).toBeCloseTo(638 / 1024, 10);
    expect(passChance(round("dog-trainer"), chances({ dog: 1 }))).toBeCloseTo(1);
    expect(passChance(round("dog-trainer"), chances({}))).toBe(0);
  });
  it("is highest for Coin Flip when the words are even", () => {
    const even = passChance(round("coin-flip"), chances({ dog: 0.5, cat: 0.5 }))!;
    const lopsided = passChance(round("coin-flip"), chances({ dog: 0.8, cat: 0.2 }))!;
    expect(even).toBeGreaterThan(0.85);
    expect(lopsided).toBeLessThan(0.1); // cat still reaches 7 of 20 about 9% of the time
  });
  it("is null for the tutorial and Sandbox", () => {
    expect(passChance(round("sandbox"), chances({ dog: 1 }))).toBeNull();
    expect(passChance(round("tutorial"), chances({ dog: 1 }))).toBeNull();
  });
  it("makes luck matter less as spins go up", () => {
    // A weak sentence (dog 40%) sometimes passes 10 spins but almost never 100.
    const weak = chances({ dog: 0.4 });
    const ten = passChance(round("dog-trainer"), weak)!;
    const hundred = passChance(round("mega-spin"), weak)!;
    expect(ten).toBeGreaterThan(0.3);
    expect(hundred).toBeLessThan(0.05);
    // A strong one (dog 70%) passes more reliably as spins go up.
    const strong = chances({ dog: 0.7 });
    expect(passChance(round("mega-spin"), strong)!).toBeGreaterThan(passChance(round("dog-trainer"), strong)!);
    expect(passChance(round("mega-spin"), strong)!).toBeGreaterThan(0.99);
  });
});

describe("luck", () => {
  it("calls a pass against the odds lucky", () => {
    expect(luck(true, 0.1)).toBe("lucky");
    expect(luck(true, 0.6)).toBeNull();
  });
  it("calls a miss with a good sentence unlucky", () => {
    expect(luck(false, 0.7)).toBe("unlucky");
    expect(luck(false, 0.2)).toBeNull();
    expect(luck(false, null)).toBeNull();
  });
});

describe("outOfTen", () => {
  it("speaks in kid terms", () => {
    expect(outOfTen(0.73)).toBe("about 7 times in 10");
    expect(outOfTen(0.12)).toBe("about 1 time in 10");
    expect(outOfTen(0.02)).toBe("less than 1 time in 10");
    expect(outOfTen(0.999)).toBe("almost every time");
  });
});
