/**
 * npm run fetch-model            → fp16 model (~250 MB)
 * npm run fetch-model -- --fp32  → also the fp32 fallback (~500 MB more)
 *
 * Downloads GPT-2 once into public/models/ so the app serves it itself.
 * Use this when school networks block huggingface.co. Without it, the app
 * fetches the same files from huggingface.co on first load.
 * public/models/ is gitignored.
 */
import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { MODEL_ID } from "@/lib/model/core";

const FILES = [
  "config.json",
  "generation_config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "onnx/model_fp16.onnx",
];
if (process.argv.includes("--fp32")) FILES.push("onnx/model.onnx");

const outDir = path.resolve("public/models", MODEL_ID);

async function download(file: string) {
  const dest = path.join(outDir, file);
  const url = `https://huggingface.co/${MODEL_ID}/resolve/main/${file}`;
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${res.status} ${url}`);
  const size = Number(res.headers.get("content-length") ?? 0);
  const existing = await stat(dest).catch(() => null);
  if (existing && size && existing.size === size) {
    console.log(`  ✓ ${file} (already here)`);
    await res.body.cancel();
    return;
  }
  await mkdir(path.dirname(dest), { recursive: true });
  process.stdout.write(`  ↓ ${file} (${(size / 1e6).toFixed(0)} MB)… `);
  await pipeline(Readable.fromWeb(res.body as WebReadableStream), createWriteStream(dest));
  console.log("done");
}

async function main() {
  console.log(`Downloading ${MODEL_ID} to ${outDir}`);
  for (const f of FILES) await download(f);
  console.log("Ready. The app will now load the model from /models/.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
