import { pipeline, env } from "@huggingface/transformers";

// Disable local model directory checks to download directly from HuggingFace cache
env.allowLocalModels = false;

// Singleton pipeline instance to prevent re-initializing model on each request
let embedderPromise: ReturnType<typeof pipeline<"feature-extraction">> | null = null;
let isWarmed = false;
let warmingPromise: Promise<void> | null = null;

/**
 * Returns true if the embedding pipeline has finished initialization and is ready in RAM
 */
export function isEmbeddingReady(): boolean {
  return isWarmed;
}

/**
 * Eagerly warm the ONNX embedding model in the background so cold starts
 * don't delay the first visitor's question.
 */
export async function warmEmbeddingPipeline(): Promise<void> {
  if (isWarmed) return;
  if (warmingPromise) return warmingPromise;

  warmingPromise = (async () => {
    try {
      const pipe = await getEmbeddingPipeline();
      // Run a tiny 1-token warm-up inference to load weights into ONNX session
      await pipe("warm", { pooling: "mean", normalize: true });
      isWarmed = true;
    } catch (err) {
      // Non-fatal; if warming fails (e.g. offline during tests), retry on actual query
      console.warn("Embedding pipeline warm-up non-fatal notice:", err);
    } finally {
      warmingPromise = null;
    }
  })();

  return warmingPromise;
}

export async function getEmbeddingPipeline() {
  if (!embedderPromise) {
    embedderPromise = pipeline("feature-extraction", "Xenova/bge-small-en-v1.5", {
      // 8-bit quantized weights: the same model file the bundled index was built with
      dtype: "q8",
    });
    // Let a failed model download be retried on the next request instead of caching the rejection
    embedderPromise.catch(() => {
      embedderPromise = null;
    });
  }
  return embedderPromise;
}

/**
 * Generate normalized 384-dimensional vector embedding using bge-small-en-v1.5
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await getEmbeddingPipeline();
  const output = await pipe(text, {
    pooling: "mean",
    normalize: true,
  });
  isWarmed = true;
  return Array.from(output.data as Float32Array);
}

/**
 * Embed many texts, a batch at a time. Same pooling as generateEmbedding so vectors are comparable.
 */
export async function generateEmbeddings(
  texts: string[],
  batchSize = 16
): Promise<number[][]> {
  const pipe = await getEmbeddingPipeline();
  const vectors: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const output = await pipe(batch, { pooling: "mean", normalize: true });
    const data = output.data as Float32Array;
    const dim = data.length / batch.length;
    for (let row = 0; row < batch.length; row++) {
      vectors.push(Array.from(data.subarray(row * dim, (row + 1) * dim)));
    }
  }

  isWarmed = true;
  return vectors;
}

/**
 * Cosine similarity between two normalized vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error(
      `Vector dimension mismatch: ${vecA.length} vs ${vecB.length}`
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
