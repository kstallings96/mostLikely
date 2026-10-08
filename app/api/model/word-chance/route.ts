import { PLURALS } from "@/config/game";
import { isBlockedWord, makeBlockSet } from "@/lib/blocklist";
import { getEngine } from "@/lib/spinner/server";
import { cleanText } from "../_shared";

const blockSet = makeBlockSet();

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const text = cleanText(body.text);
  if (text instanceof Response) return text;
  const word = typeof body.word === "string" ? body.word.trim().toLowerCase() : "";
  if (!/^[a-z][a-z'’-]{0,29}$/.test(word) || isBlockedWord(word, blockSet, PLURALS)) {
    return Response.json({ error: "word must be one plain word" }, { status: 400 });
  }
  return Response.json(await (await getEngine()).wordChance(text, word));
}
