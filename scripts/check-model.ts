/**
 * npm run check-model
 *
 * 1. Verifies with the real GPT-2 tokenizer that every target word (and each
 *    plural in the merge map) is ONE token when it starts a new word
 *    (" dog"). Exits with code 1 if any are not.
 * 2. Runs a few sentences through the real model + merge layer and prints
 *    the kid-word bars and a set of spins, as an end-to-end smoke test.
 */
import { env } from "@huggingface/transformers";
import { GAME, PLURALS, allTargetWords } from "@/config/game";
import { buildBlockedMask, makeBlockSet } from "@/lib/blocklist";
import { buildVocabIndex, displayBars, mergeDistribution, probOf } from "@/lib/merge";
import { decodeVocab, loadGpt2, nextTokenProbs, vocabSize, wordChance } from "@/lib/model/core";
import { keyLabel } from "@/lib/normalize";
import { countBy, cryptoRng, spin } from "@/lib/sample";
import path from "node:path";

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
    const spaced = lm.tokenizer.encode(" " + w, { add_special_tokens: false });
    const capital = lm.tokenizer.encode(" " + w[0].toUpperCase() + w.slice(1), {
      add_special_tokens: false,
    });
    const ok = spaced.length === 1;
    if (!ok) bad.push(w);
    console.log(
      `  ${ok ? "OK  " : "FAIL"} "${w}"  " ${w}"→${JSON.stringify(spaced)}` +
        `  (capitalized: ${capital.length} token${capital.length > 1 ? "s" : ""})`,
    );
  }

  // 2. End-to-end smoke test
  const t1 = Date.now();
  const size = vocabSize(lm);
  const index = buildVocabIndex(decodeVocab(lm.tokenizer, size), PLURALS);
  const mask = buildBlockedMask(index.texts, makeBlockSet(), PLURALS);
  console.log(
    `\nVocab: ${size} tokens decoded in ${Date.now() - t1}ms; ` +
      `${mask.reduce((a, b) => a + b, 0)} blocked.\n`,
  );

  for (const s of SENTENCES) {
    const t2 = Date.now();
    const probs = await nextTokenProbs(lm, s);
    const dist = mergeDistribution(probs, index, mask, GAME.xrayTokensPerBar);
    const ms = Date.now() - t2;
    console.log(`"${s} ___"   (${ms}ms, dog=${pct(probOf(dist, "dog"))}, cat=${pct(probOf(dist, "cat"))})`);
    for (const b of displayBars(dist, GAME.displayBars)) {
      const raw = b.tokens.slice(0, 4).map((t) => JSON.stringify(t.text)).join(" ");
      console.log(`  ${keyLabel(b.key).padEnd(16)} ${pct(b.p).padStart(6)}  ${raw}`);
    }
    const counts = countBy(spin(dist, 10, cryptoRng));
    console.log(`  10 spins: ${Object.entries(counts).map(([k, n]) => `${keyLabel(k)}×${n}`).join(", ")}\n`);
  }

  // 3. Multi-piece guesses ("fido" is not one token)
  for (const [s, w] of [["My dog's name is", "fido"], ["My dog's name is", "max"]] as const) {
    const c = await wordChance(lm, s, w);
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
