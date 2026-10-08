/**
 * Server side of local-file logging: one JSON file per session in logs/
 * (or LOGS_DIR), on the computer running the app. Writes are merged by
 * (session_id, seq), so a retried batch never duplicates events.
 *
 * Supabase replaces this module in the next step; nothing else changes.
 */
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EventRecord, LogBatch, SessionFile } from "./logTypes";

// The ignore comment stops the bundler from tracing every file on disk
// because of the computed path (logs are data, not code to bundle).
export const LOGS_DIR = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.LOGS_DIR || "logs");

/** Vercel's servers throw away files, so don't pretend to save there. */
export function fileLoggingAvailable(): boolean {
  return !process.env.VERCEL;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns an error message, or null if the batch looks right. */
export function checkBatch(batch: unknown): string | null {
  const b = batch as LogBatch;
  if (!b || typeof b !== "object" || !b.session || !Array.isArray(b.events)) return "expected {session, events}";
  if (!UUID.test(String(b.session.id))) return "bad session id";
  if (typeof b.session.first_name !== "string" || b.session.first_name.length > 40) return "bad first_name";
  if (typeof b.session.last_initial !== "string" || b.session.last_initial.length > 2) return "bad last_initial";
  if (b.events.length > 100) return "too many events";
  for (const e of b.events) {
    if (e.session_id !== b.session.id) return "event from another session";
    if (!Number.isInteger(e.seq) || e.seq < 1) return "bad seq";
    if (typeof e.event_type !== "string" || typeof e.round !== "string") return "bad event";
  }
  if (JSON.stringify(b).length > 1_000_000) return "batch too large";
  return null;
}

// Writes to the same file happen one at a time.
const locks = new Map<string, Promise<unknown>>();

export async function appendBatch(batch: LogBatch): Promise<void> {
  const file = path.join(LOGS_DIR, `${batch.session.id}.json`);
  const prev = locks.get(file) ?? Promise.resolve();
  const run = prev.then(async () => {
    await mkdir(LOGS_DIR, { recursive: true });
    const existing = await readSessionFile(file);
    const bySeq = new Map<number, EventRecord>();
    for (const e of existing?.events ?? []) bySeq.set(e.seq, e);
    for (const e of batch.events) if (!bySeq.has(e.seq)) bySeq.set(e.seq, e);
    const out: SessionFile = {
      session: existing?.session ?? batch.session,
      events: [...bySeq.values()].sort((a, b) => a.seq - b.seq),
    };
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(out, null, 2));
    await rename(tmp, file); // never leaves a half-written file
  });
  locks.set(file, run.catch(() => undefined));
  await run;
}

async function readSessionFile(file: string): Promise<SessionFile | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as SessionFile;
  } catch {
    return null;
  }
}

export async function readAllSessions(): Promise<SessionFile[]> {
  let names: string[] = [];
  try {
    names = (await readdir(LOGS_DIR)).filter((n) => n.endsWith(".json"));
  } catch {
    return [];
  }
  const files = await Promise.all(names.map((n) => readSessionFile(path.join(LOGS_DIR, n))));
  return files
    .filter((f): f is SessionFile => !!f)
    .sort((a, b) => b.session.started_at.localeCompare(a.session.started_at));
}
