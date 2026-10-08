import { headers } from "next/headers";
import { readAllSessions } from "@/lib/logStore";
import { eventsCsv, isLocalHost, sessionsCsv } from "@/lib/researcher";

/** GET /api/researcher/export?table=events|sessions → CSV download. */
export async function GET(req: Request) {
  if (!isLocalHost((await headers()).get("host"))) return new Response("Not found", { status: 404 });
  const table = new URL(req.url).searchParams.get("table") === "sessions" ? "sessions" : "events";
  const files = await readAllSessions();
  const csv = table === "sessions" ? sessionsCsv(files) : eventsCsv(files);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="most-likely-${table}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
