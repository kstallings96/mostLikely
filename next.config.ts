import type { NextConfig } from "next";

// In browser mode, GPT-2 runs in each kid's browser, so the server-side model
// engine (onnxruntime-node alone is ~290 MB) must not be bundled into
// serverless functions: it would blow past Vercel's 250 MB function limit.
const browserMode = process.env.NEXT_PUBLIC_MODEL_MODE === "browser";

const nextConfig: NextConfig = {
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
