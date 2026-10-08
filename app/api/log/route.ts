import { appendBatch, checkBatch, fileLoggingAvailable } from "@/lib/logStore";

/** Receives batches of research events from kids' browsers. */
export async function POST(req: Request) {
  if (!fileLoggingAvailable()) {
    return Response.json({ error: "this server does not store logs" }, { status: 503 });
  }
  const batch = await req.json().catch(() => null);
  const problem = checkBatch(batch);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  try {
    await appendBatch(batch);
    return Response.json({ ok: true, saved: batch.events.length });
  } catch (err) {
    console.error("[most-likely] could not write log file:", err);
    return Response.json({ error: "could not save" }, { status: 500 });
  }
}
