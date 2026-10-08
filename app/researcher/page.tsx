import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { fileLoggingAvailable, LOGS_DIR, readAllSessions } from "@/lib/logStore";
import { isLocalHost, summarize } from "@/lib/researcher";

export const metadata: Metadata = { title: "Most Likely: Researcher", robots: { index: false } };

/** Session list + CSV export, read from the local log files. Only answers on this computer. */
export default function ResearcherPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand">Most Likely · Researcher</h1>
          <p className="text-muted">Sessions saved on this computer.</p>
        </div>
        <div className="flex gap-3">
          <a
            href="/api/researcher/export?table=events"
            className="rounded-xl bg-brand px-4 py-2 font-bold text-white"
          >
            ⬇ Events CSV
          </a>
          <a
            href="/api/researcher/export?table=sessions"
            className="rounded-xl border-2 border-brand px-4 py-2 font-bold text-brand"
          >
            ⬇ Sessions CSV
          </a>
        </div>
      </header>
      <Suspense fallback={<p className="text-muted">Reading log files…</p>}>
        <Sessions />
      </Suspense>
    </main>
  );
}

async function Sessions() {
  if (!isLocalHost((await headers()).get("host"))) {
    return <p className="text-xl">This page only opens on the computer running Most Likely.</p>;
  }
  if (!fileLoggingAvailable()) {
    return <p className="text-xl">This server doesn’t save logs (it’s the Vercel test site).</p>;
  }
  const sessions = (await readAllSessions()).map(summarize);
  if (sessions.length === 0) {
    return (
      <p className="text-xl">
        No sessions yet. Logs will appear in <code className="rounded bg-ink/5 px-1">{LOGS_DIR}</code>.
      </p>
    );
  }
  const totals = {
    sentences: sessions.reduce((s, x) => s + x.sentences, 0),
    spins: sessions.reduce((s, x) => s + x.spin_sets, 0),
  };
  return (
    <section className="flex flex-col gap-3">
      <p className="text-muted">
        {sessions.length} sessions · {totals.sentences} sentences · {totals.spins} spin sets · files in{" "}
        <code className="rounded bg-ink/5 px-1">{LOGS_DIR}</code>
      </p>
      <div className="overflow-x-auto rounded-2xl border-2 border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-soft">
            <tr>
              {["Kid", "Started", "Minutes", "Sentences", "Spin sets", "Rounds", "Model load", "Device RAM", "Errors", "Version"].map(
                (h) => (
                  <th key={h} className="px-3 py-2 font-bold">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="px-3 py-2 font-bold">{s.name}</td>
                <td className="px-3 py-2">{new Date(s.started_at).toLocaleString()}</td>
                <td className="px-3 py-2">{s.minutes ?? "–"}</td>
                <td className="px-3 py-2">{s.sentences}</td>
                <td className="px-3 py-2">{s.spin_sets}</td>
                <td className="px-3 py-2">{s.rounds.join(", ") || "–"}</td>
                <td className="px-3 py-2">
                  {s.load_ms === null ? "–" : `${(s.load_ms / 1000).toFixed(1)} s`}
                  <span className="text-muted"> ({s.model_mode})</span>
                </td>
                <td className="px-3 py-2">{s.device_memory_gb === null ? "–" : `${s.device_memory_gb} GB`}</td>
                <td className={`px-3 py-2 ${s.errors ? "font-bold text-coral" : ""}`}>{s.errors}</td>
                <td className="px-3 py-2 font-mono text-xs">{s.app_version}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
