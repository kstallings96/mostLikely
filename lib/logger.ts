/**
 * Research logging. Everything the app records goes through this module, so
 * the transport can be swapped (local files now, Supabase later) without
 * touching the rest of the app.
 *
 * Record shapes match the planned Supabase tables:
 *   session: id, team_code, started_at, user_agent
 *   events:  id, session_id, seq, round, event_type, sentence,
 *            distribution, prediction, spin_results, words_changed,
 *            timestamp
 *
 * Logging must never break the game: every public function swallows its
 * own errors.
 */

export type EventType =
  | "session_start"
  | "sentence_submitted"
  | "sentence_blocked"
  | "prediction"
  | "spin_set"
  | "peek"
  | "xray_toggle"
  | "round_start"
  | "round_complete";

export interface SessionRecord {
  id: string;
  team_code: string;
  started_at: string;
  user_agent: string;
}

export interface EventRecord {
  id: string;
  session_id: string;
  /** Per-session counter; with session_id, a unique key for safe retries. */
  seq: number;
  round: string;
  event_type: EventType;
  sentence: string | null;
  /** Merged top-10 kid words: [{word, p}] */
  distribution: { word: string; p: number }[] | null;
  /** A count ("dog ×7") or a word, depending on the round. */
  /** custom: the kid typed their own word; chance: its probability for the sentence. */
  prediction: { word: string; count?: number; custom?: boolean; chance?: number; pieces?: string[] } | null;
  /** Spin results: [{word, token}] in order, plus anything round-specific. */
  spin_results: unknown;
  words_changed: number | null;
  /** Client clock, ISO 8601. */
  timestamp: string;
}

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

let session: SessionRecord | null = null;
let seq = 0;

export function startSession(teamCode: string): SessionRecord {
  session = {
    id: uuid(),
    team_code: teamCode,
    started_at: new Date().toISOString(),
    user_agent: navigator.userAgent,
  };
  seq = 0;
  safely(() => send({ kind: "session", session: session! }));
  logEvent({ round: "start", event_type: "session_start" });
  return session;
}

export function currentSession(): SessionRecord | null {
  return session;
}

export function logEvent(input: EventInput): void {
  if (!session) return;
  const record: EventRecord = {
    id: uuid(),
    session_id: session.id,
    seq: ++seq,
    sentence: null,
    distribution: null,
    prediction: null,
    spin_results: null,
    words_changed: null,
    ...input,
    timestamp: new Date().toISOString(),
  };
  safely(() => send({ kind: "event", event: record }));
}

type Envelope = { kind: "session"; session: SessionRecord } | { kind: "event"; event: EventRecord };

// Transport. Stage (d) replaces this with the local-file API route.
function send(envelope: Envelope): void {
  if (process.env.NODE_ENV === "development") console.debug("[log]", envelope);
}

function safely(fn: () => void) {
  try {
    fn();
  } catch (err) {
    console.warn("[most-likely] logging failed; the game continues.", err);
  }
}
