/**
 * Data for /researcher: session summaries and CSV exports, read from the
 * local log files.
 */
import { toCsv } from "./csv";
import type { SessionFile } from "./logTypes";

/** /researcher only answers on the computer running the app, not to kids on the network. */
export function isLocalHost(host: string | null): boolean {
  const name = (host ?? "").replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return ["localhost", "127.0.0.1", "::1"].includes(name);
}

export interface SessionSummary {
  id: string;
  name: string;
  started_at: string;
  minutes: number | null;
  sentences: number;
  spin_sets: number;
  rounds: string[];
  load_ms: number | null;
  device_memory_gb: number | null;
  errors: number;
  app_version: string;
  model_mode: string;
}

export function summarize(f: SessionFile): SessionSummary {
  const ev = f.events;
  const times = ev.map((e) => Date.parse(e.timestamp)).filter(Number.isFinite);
  const ready = ev.find((e) => e.event_type === "model_ready")?.detail ?? null;
  return {
    id: f.session.id,
    name: `${f.session.first_name} ${f.session.last_initial}.`,
    started_at: f.session.started_at,
    minutes: times.length > 1 ? Math.round((Math.max(...times) - Math.min(...times)) / 600) / 100 : null,
    sentences: ev.filter((e) => e.event_type === "sentence_submitted").length,
    spin_sets: ev.filter((e) => e.event_type === "spin_set").length,
    rounds: [...new Set(ev.map((e) => e.round).filter((r) => r !== "start" && r !== "end"))],
    load_ms: (ready?.load_ms as number | undefined) ?? null,
    device_memory_gb: (ready?.device_memory_gb as number | undefined) ?? null,
    errors: ev.filter((e) => e.event_type === "error").length,
    app_version: f.session.app_version,
    model_mode: f.session.model_mode,
  };
}

export const SESSION_COLUMNS = [
  "id", "first_name", "last_initial", "started_at", "user_agent", "app_version", "model_mode", "config",
];

export const EVENT_COLUMNS = [
  "session_id", "first_name", "last_initial", "seq", "timestamp", "round", "event_type", "sentence",
  "attempt", "words_changed", "prediction_word", "prediction_count", "prediction_custom", "prediction_chance",
  "spin_counts", "spins", "distribution", "detail", "id",
];

export function sessionsCsv(files: SessionFile[]): string {
  return toCsv(SESSION_COLUMNS, files.map((f) => ({ ...f.session })));
}

/** One row per event; JSON columns stay JSON so nothing is lost. */
export function eventsCsv(files: SessionFile[]): string {
  const rows = files.flatMap((f) =>
    f.events.map((e) => {
      const spin = e.spin_results as { spins?: unknown; counts?: unknown } | null;
      return {
        ...e,
        first_name: f.session.first_name,
        last_initial: f.session.last_initial,
        prediction_word: e.prediction?.word,
        prediction_count: e.prediction?.count,
        prediction_custom: e.prediction?.custom,
        prediction_chance: e.prediction?.chance,
        spin_counts: spin?.counts,
        spins: spin?.spins,
      };
    }),
  );
  return toCsv(EVENT_COLUMNS, rows);
}
