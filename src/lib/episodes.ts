import fs from "fs";
import path from "path";
import { PodcastEpisode } from "@/types/podcast";
import indexedEpisodesData from "@/data/indexed-episodes.json";

// Server-only: episodes carry 384-d vectors for every chunk.
// Pages must pass episodes through stripEmbeddings() before handing them to client components.

// Demo episodes checked into the repo
const BUILT_IN_EPISODES: PodcastEpisode[] = indexedEpisodesData as PodcastEpisode[];

// Episodes ingested at runtime from YouTube links, one JSON file each
const LIBRARY_DIR = path.join(process.cwd(), "data", "library");

// Parsed library files, so a search doesn't re-read megabytes of vectors from disk
const libraryCache = new Map<string, PodcastEpisode>();

function libraryPath(id: string): string {
  return path.join(LIBRARY_DIR, `${id}.json`);
}

function loadLibraryEpisode(id: string): PodcastEpisode | undefined {
  const cached = libraryCache.get(id);
  if (cached) return cached;

  const file = libraryPath(id);
  if (!fs.existsSync(file)) return undefined;
  const episode = JSON.parse(fs.readFileSync(file, "utf-8")) as PodcastEpisode;
  libraryCache.set(id, episode);
  return episode;
}

function listLibraryIds(): string[] {
  if (!fs.existsSync(LIBRARY_DIR)) return [];
  return fs
    .readdirSync(LIBRARY_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -".json".length));
}

export function getEpisodeById(id: string): PodcastEpisode | undefined {
  const builtIn = BUILT_IN_EPISODES.find((ep) => ep.id === id);
  if (builtIn) return builtIn;
  // Ids come from request bodies; never let one walk out of the library directory
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return undefined;
  return loadLibraryEpisode(id);
}

/**
 * Built-in demo episodes first, then ingested ones, newest first
 */
export function getAllEpisodes(): PodcastEpisode[] {
  const library = listLibraryIds()
    .map((id) => ({ id, mtime: fs.statSync(libraryPath(id)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .map(({ id }) => loadLibraryEpisode(id))
    .filter((ep): ep is PodcastEpisode => ep !== undefined);
  return [...BUILT_IN_EPISODES, ...library];
}

export function saveLibraryEpisode(episode: PodcastEpisode): void {
  fs.mkdirSync(LIBRARY_DIR, { recursive: true });
  fs.writeFileSync(libraryPath(episode.id), JSON.stringify(episode), "utf-8");
  libraryCache.set(episode.id, episode);
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
