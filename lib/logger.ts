/**
 * Research logging. Everything the app records goes through this module, so
 * the transport can be swapped (local files now, Supabase next) without
 * touching the rest of the app.
 *
 * Events wait in a durable queue: mirrored to localStorage on every append
 * and only removed once the server confirms it saved them, so a wifi drop or
 * a reload doesn't lose data. Logging never breaks the game: every public
 * function swallows its own errors.
 */
import { GAME, PLURALS, ROUNDS } from "@/config/game";
import { wordEditDistance } from "./editDistance";
import type { EventRecord, LogBatch, SessionRecord } from "./logTypes";
import { MODEL_MODE } from "./spinner/mode";

export type { EventType } from "./logTypes";

export type EventInput = Pick<EventRecord, "round" | "event_type"> &
  Partial<Omit<EventRecord, "id" | "session_id" | "seq" | "timestamp" | "round" | "event_type">>;

/**
 * crypto.randomUUID only exists on https or localhost. Over plain http on a
 * classroom network (kids opening http://<laptop-ip>:3000) fall back to
 * building a v4 UUID from getRandomValues, which works everywhere.
 */
export function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** One localStorage entry per session: most-likely:log-queue:<session id> */
const STORAGE_PREFIX = "most-likely:log-queue:";
const BATCH_SIZE = 20;
const FLUSH_MS = 3000;

let session: SessionRecord | null = null;
let seq = 0;
let queue: EventRecord[] = [];
/** Events from before Start was pressed (e.g. the model finished loading). */
let early: EventInput[] = [];
let lastSentence: string | null = null;
const attemptsByRound = new Map<string, number>();
let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushing = false;
/** Set when the server says it cannot store logs (e.g. the Vercel test site). */
let disabled = false;

export function startSession(firstName: string, lastInitial: string): SessionRecord {
  session = {
    id: uuid(),
    first_name: firstName,
    last_initial: lastInitial,
    started_at: new Date().toISOString(),
    user_agent: navigator.userAgent,
    app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
    model_mode: MODEL_MODE,
    config: { game: GAME, rounds: ROUNDS, plurals: PLURALS },
  };
  seq = 0;
  queue = [];
  lastSentence = null;
  attemptsByRound.clear();
  safely(() => {
    persist();
    flushTimer ??= setInterval(() => void flush(), FLUSH_MS);
    window.addEventListener("pagehide", onPageHide);
  });
  logEvent({ round: "start", event_type: "session_start" });
  for (const e of early) logEvent(e);
  early = [];
  return session;
}

export function currentSession(): SessionRecord | null {
  return session;
}

export function logEvent(input: EventInput): void {
  safely(() => {
    if (!session) {
      // Only model/device info is worth keeping from before Start.
      if (input.event_type === "model_ready" || input.event_type === "error") early.push(input);
      return;
    }
    const record: EventRecord = {
      id: uuid(),
      session_id: session.id,
      seq: ++seq,
      sentence: null,
      distribution: null,
      prediction: null,
      spin_results: null,
      words_changed: null,
      attempt: null,
      detail: null,
      ...input,
      timestamp: new Date().toISOString(),
    };
    if (record.event_type === "sentence_submitted" && record.sentence !== null) {
      // The revision sequence is the research data: how far each sentence is
      // from this kid's previous one, and which try this is in the round.
      record.words_changed = lastSentence === null ? null : wordEditDistance(lastSentence, record.sentence);
      lastSentence = record.sentence;
      const n = (attemptsByRound.get(record.round) ?? 0) + 1;
      attemptsByRound.set(record.round, n);
      record.attempt = n;
    }
    if (disabled) return;
    queue.push(record);
    persist();
    if (queue.length >= BATCH_SIZE) void flush();
  });
}

/** Send queued events. Nothing leaves the queue until the server confirms it. */
export async function flush(keepalive = false): Promise<void> {
  if (!session || flushing || disabled || queue.length === 0) return;
  flushing = true;
  const batch: LogBatch = { session, events: queue.slice(0, BATCH_SIZE) };
  try {
    const res = await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
      keepalive, // survives the page closing; sendBeacon is avoided on purpose
    });
    if (res.ok) {
      const sent = new Set(batch.events.map((e) => e.seq));
      queue = queue.filter((e) => !sent.has(e.seq));
      persist();
    } else if (res.status === 503) {
      // This server has nowhere to keep logs (e.g. the Vercel test site).
      disabled = true;
      queue = [];
      persist();
      console.info("[most-likely] research logging is off on this server.");
    }
  } catch {
    // Offline or the server is down: keep everything and try again later.
  } finally {
    flushing = false;
  }
  if (queue.length >= BATCH_SIZE) void flush(keepalive);
}

function onPageHide() {
  logEvent({ round: "end", event_type: "session_end" });
  void flush(true);
}

/** Mirror the queue so a reload or crash can't lose unsent events. */
function persist() {
  try {
    if (!session) return;
    const key = STORAGE_PREFIX + session.id;
    if (queue.length) localStorage.setItem(key, JSON.stringify({ session, events: queue }));
    else localStorage.removeItem(key);
  } catch {
    // Storage full or blocked: the in-memory queue still works.
  }
}

/**
 * On page load, send anything a previous visit left unsent (the kid
 * reloaded, or the wifi dropped before it was saved).
 */
export async function recoverUnsent(): Promise<void> {
  try {
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith(STORAGE_PREFIX) && k !== STORAGE_PREFIX + session?.id,
    );
    for (const key of keys) {
      const batch = JSON.parse(localStorage.getItem(key) ?? "null") as LogBatch | null;
      if (!batch) continue;
      let ok = true;
      for (let i = 0; i < batch.events.length && ok; i += BATCH_SIZE) {
        const res = await fetch("/api/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: batch.session, events: batch.events.slice(i, i + BATCH_SIZE) }),
        });
        ok = res.ok || res.status === 503; // otherwise try again next visit
      }
      if (ok) localStorage.removeItem(key);
    }
  } catch {
    // Try again next visit.
  }
}

function safely(fn: () => void) {
  try {
    fn();
  } catch (err) {
    console.warn("[most-likely] logging failed; the game continues.", err);
  }
}
