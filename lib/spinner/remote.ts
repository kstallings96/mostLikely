/**
 * Server mode, client side: the kid's browser just sends sentences to the
 * machine running the app (e.g. the researcher's laptop) and gets spinners
 * and spins back. No model download on the kid's laptop.
 */
import type { SpinResult } from "@/lib/sample";
import type { LoadInfo, SpinnerBackend, SpinnerView, WordChance } from "./types";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export type ServerStatus =
  | { status: "loading" }
  | { status: "ready"; loadMs: number }
  | { status: "error"; message: string };

export class RemoteBackend implements SpinnerBackend {
  readonly mode = "server";
  readonly ready: Promise<LoadInfo>;

  constructor() {
    this.ready = (async () => {
      const t0 = performance.now();
      // The server loads GPT-2 once at startup; wait for it.
      for (;;) {
        try {
          const res = await fetch("/api/model/status", { cache: "no-store" });
          const s = (await res.json()) as ServerStatus;
          if (s.status === "ready") return { dtype: "server", loadMs: Math.round(performance.now() - t0) };
          if (s.status === "error") throw new Error(s.message);
        } catch (err) {
          if (err instanceof Error && !/fetch|network|JSON/i.test(err.message)) throw err;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    })();
  }

  view(text: string) {
    return post<SpinnerView>("/api/model/view", { text });
  }
  spin(view: SpinnerView, n: number) {
    return post<SpinResult[]>("/api/model/spin", { text: view.sentence, n });
  }
  wordChance(text: string, word: string) {
    return post<WordChance>("/api/model/word-chance", { text, word });
  }
}
