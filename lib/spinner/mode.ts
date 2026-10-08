/**
 * Where GPT-2 runs. Set NEXT_PUBLIC_MODEL_MODE in .env.local:
 *   server  (default) the computer running the app runs the model; kids'
 *           laptops only show the page.
 *   browser each kid's browser downloads (~250 MB) and runs the model.
 */
export const MODEL_MODE: "server" | "browser" =
  process.env.NEXT_PUBLIC_MODEL_MODE === "browser" ? "browser" : "server";
