import { execSync } from "node:child_process";
import type { NextConfig } from "next";
import pkg from "./package.json";

// Stamped into every research session so data from different builds can be
// told apart: "0.1.0+7b5675d".
function appVersion(): string {
  let sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  try {
    sha ??= execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    sha = "unknown";
  }
  return `${pkg.version}+${sha}`;
}

// In browser mode, GPT-2 runs in each kid's browser, so the server-side model
// engine (onnxruntime-node alone is ~290 MB) must not be bundled into
// serverless functions: it would blow past Vercel's 250 MB function limit.
const browserMode = process.env.NEXT_PUBLIC_MODEL_MODE === "browser";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: appVersion() },
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingExcludes: browserMode
    ? {
        "/*": [
          "node_modules/onnxruntime-node/**",
          "node_modules/onnxruntime-web/**",
          "node_modules/@huggingface/transformers/**",
          "node_modules/sharp/**",
          "node_modules/@img/**",
          ".cache/**",
        ],
      }
    : undefined,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
