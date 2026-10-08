/**
 * npm run check-model
 *
 * 1. Verifies with the real GPT-2 tokenizer that every target word (and each
 *    plural in the merge map) is ONE token when it starts a new word
 *    (" dog"). Exits with code 1 if any are not.
 * 2. Runs a few sentences through the real model + spinner engine (the same
 *    code the server runs) and prints the Peek bars and a set of spins.
 * 3. Shows finish-the-word and multi-piece word chances.
 */
import { env } from "@huggingface/transformers";
import path from "node:path";
import { allTargetWords } from "@/config/game";
import { decodeVocab, encodeText, encodeWord, loadGpt2, probsAfterIds, vocabSize } from "@/lib/model/core";
import { keyLabel } from "@/lib/normalize";
import { countBy, cryptoRng } from "@/lib/sample";
import { SpinnerEngine } from "@/lib/spinner/engine";
import { chanceOf } from "@/lib/spinner/types";

env.cacheDir = path.resolve(".cache/transformers");

const SENTENCES = [
  "It is raining cats and",
  "The mailman was chased down the street by a big",
  "I took my pet",
  "The cat chased the",
];

async function main() {
  const t0 = Date.now();
  const lm = await loadGpt2();
  console.log(`Loaded GPT-2 (${lm.dtype}) in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  // 1. Single-token check
  console.log("Target words — must be one token with a leading space:");
  const bad: string[] = [];
  for (const w of allTargetWords()) {
    const spaced = encodeWord(lm, " " + w);
    const capital = encodeWord(lm, " " + w[0].toUpperCase() + w.slice(1));
    const ok = spaced.length === 1;
    if (!ok) bad.push(w);
    console.log(
      `  ${ok ? "OK  " : "FAIL"} "${w}"  " ${w}"→${JSON.stringify(spaced)}` +
        `  (capitalized: ${capital.length} token${capital.length > 1 ? "s" : ""})`,
    );
  }

  // 2. End-to-end: the same engine the server uses
  const t1 = Date.now();
  const engine = new SpinnerEngine({
    encode: async (text) => encodeText(lm, text),
    encodeWord: async (spaced) => encodeWord(lm, spaced),
    next: (ids) => probsAfterIds(lm, ids),
    vocab: decodeVocab(lm.tokenizer, vocabSize(lm)),
  });
  console.log(
    `\nVocab decoded + engine built in ${Date.now() - t1}ms; ` +
      `${engine.mask.reduce((a, b) => a + b, 0)} tokens blocked.\n`,
  );

  for (const s of [...SENTENCES, "my dogs name is"]) {
    const t2 = Date.now();
    const view = await engine.view(s);
    const ms = Date.now() - t2;
    console.log(`"${s} ___"   (${ms}ms, dog=${pct(chanceOf(view, "dog"))}, cat=${pct(chanceOf(view, "cat"))})`);
    for (const b of view.bars) {
      const raw = b.tokens.slice(0, 4).map((t) => JSON.stringify(t.text)).join(" ");
      console.log(`  ${keyLabel(b.key).padEnd(22)} ${pct(b.p).padStart(6)}  ${raw}`);
    }
    const t3 = Date.now();
    const spins = await engine.spin(s, 10, cryptoRng);
    const shown = Object.entries(countBy(spins)).map(([k, n]) => `${keyLabel(k)}×${n}`);
    const finished = spins.filter((r) => r.pieces).map((r) => `${r.key} (${r.pieces!.join("+")})`);
    console.log(`  10 spins (${Date.now() - t3}ms): ${shown.join(", ")}`);
    if (finished.length) console.log(`  finished words: ${finished.join(", ")}`);
    console.log();
  }

  // 3. Multi-piece guesses ("fido" is not one token)
  for (const [s, w] of [
    ["My dog's name is", "fido"],
    ["My dog's name is", "max"],
  ] as const) {
    const c = await engine.wordChance(s, w);
    console.log(`Chance "${s} ${w}": ${pct(c.p)} via ${c.pieces.map((p) => JSON.stringify(p)).join(" + ")}`);
  }
  console.log();

  if (bad.length) {
    console.error(`NOT single tokens: ${bad.join(", ")} — the merge may miss them.`);
    process.exit(1);
  }
  console.log("All target words are single tokens.");
}

function pct(p: number) {
  return `${(p * 100).toFixed(p < 0.001 ? 4 : 1)}%`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
