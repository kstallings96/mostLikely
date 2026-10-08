import { getEngine, modelStatus } from "@/lib/spinner/server";

export async function GET() {
  getEngine().catch(() => undefined); // start loading if it hasn't yet
  return Response.json(modelStatus(), { headers: { "Cache-Control": "no-store" } });
}
