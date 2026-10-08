import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { csvField, toCsv } from "@/lib/csv";
import type { EventRecord, LogBatch, SessionRecord } from "@/lib/logTypes";
import { eventsCsv, isLocalHost, summarize } from "@/lib/researcher";

let dir: string;
let store: typeof import("@/lib/logStore");

const session: SessionRecord = {
  id: "3f2c8a10-1b2c-4d5e-8f90-a1b2c3d4e5f6",
  first_name: "Ana",
  last_initial: "R",
  started_at: "2026-10-08T14:00:00.000Z",
  user_agent: "test",
  app_version: "0.1.0+test",
  model_mode: "browser",
  config: {},
};

function ev(seq: number, extra: Partial<EventRecord> = {}): EventRecord {
  return {
    id: `e${seq}`, session_id: session.id, seq, round: "sandbox", event_type: "sentence_submitted",
    sentence: null, distribution: null, prediction: null, spin_results: null, words_changed: null,
    attempt: null, detail: null, timestamp: `2026-10-08T14:0${seq}:00.000Z`, ...extra,
  };
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "most-likely-logs-"));
  process.env.LOGS_DIR = dir;
  store = await import("@/lib/logStore");
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe("local log files", () => {
  it("writes one file per session and merges retried batches without duplicates", async () => {
    await store.appendBatch({ session, events: [ev(1), ev(2)] });
    await store.appendBatch({ session, events: [ev(2), ev(3)] }); // ev 2 is a retry
    const file = JSON.parse(await readFile(path.join(dir, `${session.id}.json`), "utf8"));
    expect(file.session.first_name).toBe("Ana");
    expect(file.events.map((e: EventRecord) => e.seq)).toEqual([1, 2, 3]);
  });
  it("handles many writes to the same file at once", async () => {
    await Promise.all([4, 5, 6, 7].map((s) => store.appendBatch({ session, events: [ev(s)] })));
    const [f] = await store.readAllSessions();
    expect(f.events).toHaveLength(7);
  });
  it("rejects malformed or path-traversal batches", () => {
    expect(store.checkBatch(null)).toBeTruthy();
    expect(store.checkBatch({ session: { ...session, id: "../../etc/passwd" }, events: [] })).toBe("bad session id");
    const foreign = { ...ev(1), session_id: "00000000-0000-4000-8000-000000000000" };
    expect(store.checkBatch({ session, events: [foreign] } as LogBatch)).toBe("event from another session");
    expect(store.checkBatch({ session, events: [ev(1)] })).toBeNull();
  });
});

describe("researcher exports", () => {
  it("only opens on this computer", () => {
    expect(isLocalHost("localhost:3000")).toBe(true);
    expect(isLocalHost("127.0.0.1:3000")).toBe(true);
    expect(isLocalHost("[::1]:3000")).toBe(true);
    expect(isLocalHost("10.180.54.156:3000")).toBe(false);
    expect(isLocalHost("most-likely-smoky.vercel.app")).toBe(false);
  });
  it("escapes CSV fields", () => {
    expect(csvField('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvField({ a: 1 })).toBe('"{""a"":1}"');
    expect(csvField(null)).toBe("");
    expect(toCsv(["a"], [{ a: 1 }])).toBe("﻿a\r\n1\r\n");
  });
  it("flattens predictions and spins into the events CSV", () => {
    const csv = eventsCsv([
      {
        session,
        events: [
          ev(1, {
            event_type: "spin_set", sentence: "my dog, the", prediction: { word: "max", custom: true, chance: 0.002 },
            spin_results: { spins: [{ word: "max", token: " Max", p: 0.002 }], counts: { max: 1 } },
          }),
        ],
      },
    ]);
    const [header, row] = csv.slice(1).split("\r\n");
    expect(header.split(",")).toContain("prediction_word");
    expect(row).toContain('"my dog, the"');
    expect(row).toContain(",max,");
    expect(row).toContain("Ana,R");
  });
  it("summarizes a session", () => {
    const s = summarize({
      session,
      events: [
        ev(1, { event_type: "model_ready", round: "start", detail: { load_ms: 14000, device_memory_gb: 4 } }),
        ev(2), ev(3, { event_type: "spin_set" }), ev(4, { event_type: "error" }),
      ],
    });
    expect(s).toMatchObject({ name: "Ana R.", sentences: 1, spin_sets: 1, errors: 1, load_ms: 14000, device_memory_gb: 4, minutes: 3 });
  });
});
