import { cryptoRng } from "@/lib/sample";
import { getEngine } from "@/lib/spinner/server";
import { cleanText } from "../_shared";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const text = cleanText(body.text);
  if (text instanceof Response) return text;
  const n = Number(body.n);
  if (!Number.isInteger(n) || n < 1 || n > 100) return Response.json({ error: "n must be 1–100" }, { status: 400 });
  return Response.json(await (await getEngine()).spin(text, n, cryptoRng));
}
