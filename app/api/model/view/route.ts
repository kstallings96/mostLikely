import { MODEL_MODE } from "@/lib/spinner/mode";
import { cleanText } from "../_shared";

export async function POST(req: Request) {
  if (MODEL_MODE === "browser") return Response.json({ error: "browser mode" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const text = cleanText(body.text);
  if (text instanceof Response) return text;
  const { getEngine } = await import("@/lib/spinner/server");
  return Response.json(await (await getEngine()).view(text));
}
