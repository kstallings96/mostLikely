import { connection } from "next/server";
import { MODEL_MODE } from "@/lib/spinner/mode";

export async function GET() {
  await connection(); // answer live on every request, never a build-time snapshot
  if (MODEL_MODE === "browser") return Response.json({ error: "browser mode" }, { status: 404 });
  const { getEngine, modelStatus } = await import("@/lib/spinner/server");
  getEngine().catch(() => undefined); // start loading if it hasn't yet
  return Response.json(modelStatus(), { headers: { "Cache-Control": "no-store" } });
}
