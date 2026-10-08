/** Runs once when the server starts: begin loading GPT-2 right away in server mode. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PUBLIC_MODEL_MODE !== "browser") {
    const { getEngine } = await import("./lib/spinner/server");
    getEngine().catch((err) => console.error("[most-likely] model failed to load:", err));
  }
}
