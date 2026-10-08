import { PLURALS } from "@/config/game";
import { findBlockedWords, makeBlockSet } from "@/lib/blocklist";

const blockSet = makeBlockSet();

/** Read and check a kid's sentence from a request body. */
export function cleanText(raw: unknown): string | Response {
  if (typeof raw !== "string") return Response.json({ error: "text required" }, { status: 400 });
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || text.length > 200) return Response.json({ error: "text must be 1–200 characters" }, { status: 400 });
  if (findBlockedWords(text, blockSet, PLURALS).length) {
    return Response.json({ error: "blocked" }, { status: 422 });
  }
  return text;
}
