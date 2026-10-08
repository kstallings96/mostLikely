import { cryptoRng } from "@/lib/sample";
import { MODEL_MODE } from "@/lib/spinner/mode";
import { cleanText } from "../_shared";

export async function POST(req: Request) {
  if (MODEL_MODE === "browser") return Response.json({ error: "browser mode" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const text = cleanText(body.text);
  if (text instanceof Response) return text;
  const n = Number(body.n);
  if (!Number.isInteger(n) || n < 1 || n > 100) return Response.json({ error: "n must be 1–100" }, { status: 400 });
  const { getEngine } = await import("@/lib/spinner/server");
  return Response.json(await (await getEngine()).spin(text, n, cryptoRng));
}
