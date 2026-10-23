import fs from "fs";
import path from "path";
import { PodcastEpisode } from "@/types/podcast";
import indexedEpisodesData from "@/data/indexed-episodes.json";

// Server-only: episodes carry 384-d vectors for every chunk.
// Pages must pass episodes through stripEmbeddings() before handing them to client components.

// Featured videos checked into the repo (scripts/build-index.ts). The only ones listed publicly.
const BUILT_IN_EPISODES: PodcastEpisode[] = indexedEpisodesData as PodcastEpisode[];

// Videos visitors paste are private to them: kept in memory just long enough to answer
// questions, never listed for other visitors, and gone after a restart. The client
// re-indexes a video that was evicted (see Workbench).
const MAX_PASTED_EPISODES = Number(process.env.MAX_CACHED_VIDEOS) || 20;

// For curating featured videos locally: also write pasted videos to data/library/ so
// scripts/build-index.ts can freeze them. Off by default; never enable it on a public server.
export const SAVE_TO_DISK = process.env.SCRUBCAST_SAVE_LIBRARY === "1";
const LIBRARY_DIR = path.join(process.cwd(), "data", "library");

// Shared across route modules (Next.js may load this file once per route); Map order is LRU order
const pasted = ((globalThis as { __scrubcastPasted?: Map<string, PodcastEpisode> }).__scrubcastPasted ??=
  new Map());

export function getEpisodeById(id: string): PodcastEpisode | undefined {
  const builtIn = BUILT_IN_EPISODES.find((ep) => ep.id === id);
  if (builtIn) return builtIn;

  const cached = pasted.get(id);
  if (cached) {
    // Mark as recently used
    pasted.delete(id);
    pasted.set(id, cached);
    return cached;
  }

  // Ids come from request bodies; never let one walk out of the library directory
  if (SAVE_TO_DISK && /^[A-Za-z0-9_-]+$/.test(id)) {
    const file = path.join(LIBRARY_DIR, `${id}.json`);
    if (fs.existsSync(file)) {
      const episode = JSON.parse(fs.readFileSync(file, "utf-8")) as PodcastEpisode;
      rememberEpisode(episode);
      return episode;
    }
  }
  return undefined;
}

/**
 * The public episode list: featured videos only
 */
export function getAllEpisodes(): PodcastEpisode[] {
  return BUILT_IN_EPISODES;
}

export function isFeatured(id: string): boolean {
  return BUILT_IN_EPISODES.some((ep) => ep.id === id);
}

export function saveLibraryEpisode(episode: PodcastEpisode): void {
  rememberEpisode(episode);
  if (SAVE_TO_DISK) {
    fs.mkdirSync(LIBRARY_DIR, { recursive: true });
    fs.writeFileSync(path.join(LIBRARY_DIR, `${episode.id}.json`), JSON.stringify(episode), "utf-8");
  }
}

function rememberEpisode(episode: PodcastEpisode): void {
  pasted.delete(episode.id);
  pasted.set(episode.id, episode);
  while (pasted.size > MAX_PASTED_EPISODES) {
    const oldest = pasted.keys().next().value as string;
    pasted.delete(oldest);
  }
}

/**
 * Drop chunk embeddings so episodes can be serialized to the browser cheaply
 */
export function stripEmbeddings(episode: PodcastEpisode): PodcastEpisode {
  return {
    ...episode,
    chunks: episode.chunks.map((chunk) => ({ ...chunk, embedding: undefined })),
  };
}
