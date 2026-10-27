export async function register() {
  // Runs once when the Next.js Node.js server starts (e.g. Render/Docker boot)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { warmEmbeddingPipeline } = await import("@/lib/embeddings");
      // Asynchronously warm embedding model so the first visitor doesn't wait for ONNX init
      void warmEmbeddingPipeline();
    } catch {
      // Non-fatal: if warmup fails or runs during build steps, proceed normally
    }
  }
}
