import { getEngine } from "@/lib/spinner/server";
import { cleanText } from "../_shared";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const text = cleanText(body.text);
  if (text instanceof Response) return text;
  return Response.json(await (await getEngine()).view(text));
}
