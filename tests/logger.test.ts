/**
 * End to end, minus the browser: logger → /api/log route → log file → researcher summary.
 * fetch is pointed straight at the real route handler.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SessionFile } from "@/lib/logTypes";

let dir: string;
const store = new Map<string, string>();

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "most-likely-logger-"));
  process.env.LOGS_DIR = dir;
  const { POST } = await import("@/app/api/log/route");
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => POST(new Request(`http://localhost${url}`, init)));
  vi.stubGlobal("window", { addEventListener: () => {} });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await rm(dir, { recursive: true, force: true });
});

describe("logger → /api/log → file", () => {
  it("saves a kid's session with revisions, attempts and spin chances", async () => {
    const logger = await import("@/lib/logger");
    // Model finished loading before the kid pressed Start: kept and logged after.
    logger.logEvent({ round: "start", event_type: "model_ready", detail: { load_ms: 14000, device_memory_gb: 4 } });
    const s = logger.startSession("Ana", "R");
    logger.logEvent({ round: "sandbox", event_type: "sentence_submitted", sentence: "My dog is" });
    logger.logEvent({ round: "sandbox", event_type: "sentence_submitted", sentence: "My big dog is" });
    logger.logEvent({ round: "dog-trainer", event_type: "sentence_submitted", sentence: "My big cat is" });
    logger.logEvent({
      round: "dog-trainer",
      event_type: "spin_set",
      spin_results: { spins: [{ word: "dog", token: " dog", p: 0.4 }], counts: { dog: 1 } },
    });
    expect(store.size).toBe(1); // mirrored to localStorage until the server confirms
    await logger.flush();
    expect(store.size).toBe(0);

    const file = JSON.parse(await readFile(path.join(dir, `${s.id}.json`), "utf8")) as SessionFile;
    expect(file.session).toMatchObject({ first_name: "Ana", last_initial: "R", model_mode: "server" });
    expect(file.session.config).toHaveProperty("rounds");
    const types = file.events.map((e) => e.event_type);
    expect(types).toEqual(["session_start", "model_ready", "sentence_submitted", "sentence_submitted", "sentence_submitted", "spin_set"]);
    const sentences = file.events.filter((e) => e.event_type === "sentence_submitted");
    expect(sentences.map((e) => [e.words_changed, e.attempt])).toEqual([
      [null, 1], // first sentence
      [1, 2], //    added "big"
      [1, 1], //    dog → cat, and the first try in a new round
    ]);
    expect(file.events.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("keeps events queued when the server can't be reached", async () => {
    const logger = await import("@/lib/logger");
    logger.startSession("Ben", "T");
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
    logger.logEvent({ round: "sandbox", event_type: "peek" });
    await logger.flush();
    expect([...store.values()].join()).toContain('"event_type":"peek"');
  });
});
