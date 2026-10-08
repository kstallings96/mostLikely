import { PLURALS } from "@/config/game";
import { isBlockedWord, makeBlockSet } from "@/lib/blocklist";
import { MODEL_MODE } from "@/lib/spinner/mode";
import { cleanText } from "../_shared";

const blockSet = makeBlockSet();

export async function POST(req: Request) {
  if (MODEL_MODE === "browser") return Response.json({ error: "browser mode" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const text = cleanText(body.text);
  if (text instanceof Response) return text;
  const word = typeof body.word === "string" ? body.word.trim().toLowerCase() : "";
  if (!/^[a-z][a-z'’-]{0,29}$/.test(word) || isBlockedWord(word, blockSet, PLURALS)) {
    return Response.json({ error: "word must be one plain word" }, { status: 400 });
  }
  const { getEngine } = await import("@/lib/spinner/server");
  return Response.json(await (await getEngine()).wordChance(text, word));
}
