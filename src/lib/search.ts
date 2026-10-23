import { SearchMatch } from "@/types/podcast";
import { getEpisodeById } from "./episodes";
import { cosineSimilarity, generateEmbedding } from "./embeddings";

export async function searchEpisodeChunks(
  query: string,
  episodeId: string,
  topK = 5
): Promise<{ matches: SearchMatch[]; embeddingLatencyMs: number; searchLatencyMs: number }> {
  const episode = getEpisodeById(episodeId);
  if (!episode) {
    throw new Error(`Episode not found: ${episodeId}`);
  }

  // 1. Generate query vector using local bge-small-en-v1.5
  const t0 = Date.now();
  const queryEmbedding = await generateEmbedding(query);
  const t1 = Date.now();
  const embeddingLatencyMs = t1 - t0;

  // 2. Cosine similarity against pre-indexed episode chunks
  const scoredChunks: SearchMatch[] = [];

  for (const chunk of episode.chunks) {
    if (!chunk.embedding || chunk.embedding.length === 0) continue;
    const score = cosineSimilarity(queryEmbedding, chunk.embedding);
    scoredChunks.push({
      chunk,
      score,
    });
  }

  // 3. Sort descending by similarity score
  scoredChunks.sort((a, b) => b.score - a.score);

  const t2 = Date.now();
  const searchLatencyMs = t2 - t1;

  return {
    matches: scoredChunks.slice(0, topK),
    embeddingLatencyMs,
    searchLatencyMs,
  };
}
