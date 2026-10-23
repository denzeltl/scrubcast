import fs from "fs";
import path from "path";
import { RAW_EPISODES } from "../src/data/raw-episodes";
import { generateEmbedding } from "../src/lib/embeddings";

async function buildIndex() {
  console.log("=== Building Scrubcast Vector Index ===");
  console.log(`Processing ${RAW_EPISODES.length} episodes...`);

  const indexedEpisodes = [];

  for (const ep of RAW_EPISODES) {
    console.log(`\nIndexing episode: "${ep.title}" (${ep.chunks.length} chunks)...`);
    const indexedChunks = [];

    for (let i = 0; i < ep.chunks.length; i++) {
      const chunk = ep.chunks[i];
      process.stdout.write(`  [${i + 1}/${ep.chunks.length}] Embedding chunk at ${chunk.startTime}s (${chunk.speaker})... `);
      const t0 = Date.now();
      const embedding = await generateEmbedding(chunk.text);
      const dt = Date.now() - t0;
      console.log(`✓ (${dt}ms, dim=${embedding.length})`);

      indexedChunks.push({
        ...chunk,
        embedding,
      });
    }

    indexedEpisodes.push({
      ...ep,
      chunks: indexedChunks,
    });
  }

  const outputPath = path.resolve(__dirname, "../src/data/indexed-episodes.json");
  fs.writeFileSync(outputPath, JSON.stringify(indexedEpisodes, null, 2), "utf-8");
  console.log(`\nSuccessfully written indexed episodes to: ${outputPath}`);
}

buildIndex().catch((err) => {
  console.error("Index build failed:", err);
  process.exit(1);
});
