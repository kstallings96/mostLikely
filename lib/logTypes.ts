/**
 * Research log record shapes, shared by the browser logger, the local-file
 * API route, and /researcher. They match the planned Supabase tables:
 *
 *   sessions: one row per kid. The ONLY place identifying data lives
 *             (first name + last initial).
 *   events:   append-only, keyed by (session_id, seq) so retries are safe.
 */

export type EventType =
  | "session_start"
  | "model_ready"
  | "sentence_submitted"
  | "sentence_blocked"
  | "prediction"
  | "spin_set"
  | "peek"
  | "xray_toggle"
  | "round_start"
  | "round_complete"
  | "error"
  | "session_end";

export interface SessionRecord {
  id: string;
  first_name: string;
  last_initial: string;
  started_at: string;
  user_agent: string;
  /** App version + git commit, so data from different builds can be told apart. */
  app_version: string;
  /** "browser" or "server": where GPT-2 ran. */
  model_mode: string;
  /** Snapshot of config/game.ts (thresholds, budgets, targets) at session start. */
  config: unknown;
}

export interface EventRecord {
  id: string;
  session_id: string;
  /** Per-session counter; with session_id, a unique key for safe retries. */
  seq: number;
  round: string;
  event_type: EventType;
  sentence: string | null;
  /** Merged top-10 kid words for the sentence: [{word, p}]. */
  distribution: { word: string; p: number }[] | null;
  /**
   * The kid's guess. `count` for "how many out of 10" rounds; `custom` when
   * they typed their own word; `chance`/`pieces` for typed words.
   */
  prediction: { word: string; count?: number; custom?: boolean; chance?: number; pieces?: string[] } | null;
  /** spin_set: {spins: [{word, token, p, pieces?}], counts, skipped_animation}. */
  spin_results: unknown;
  /** sentence_submitted: word-level edit distance from this kid's previous sentence. */
  words_changed: number | null;
  /** sentence_submitted: 1 for the first sentence in this round, 2 for the next… */
  attempt: number | null;
  /** Event-specific extras (model load time and device, error messages…). */
  detail: Record<string, unknown> | null;
  /** Client clock, ISO 8601. */
  timestamp: string;
}

/** What the browser POSTs to /api/log. */
export interface LogBatch {
  session: SessionRecord;
  events: EventRecord[];
}

/** One file per session in logs/: logs/<session id>.json */
export interface SessionFile {
  session: SessionRecord;
  events: EventRecord[];
}
