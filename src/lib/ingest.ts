import { PodcastEpisode, TranscriptChunk } from "@/types/podcast";
import { generateEmbeddings } from "./embeddings";
import { getEpisodeById, saveLibraryEpisode } from "./episodes";
import { ensureSummary } from "./summary";
import { CaptionSegment, fetchYouTubeVideo, parseYouTubeVideoId } from "./youtube";

// Caption lines are only a few seconds long. Grouping them into ~30-45s passages
// gives each embedding enough context to match a question, while keeping a
// citation close to the moment it points at.
const MIN_CHUNK_SECONDS = 30;
const MAX_CHUNK_SECONDS = 45;

// Captions don't say who is talking
const UNKNOWN_SPEAKER = "Speaker";

const GENERIC_QUERIES = [
  "What is the main argument of this video?",
  "What advice is given?",
  "What examples or stories are told?",
  "What predictions are made about the future?",
];

// Two clicks on the same link share one ingest instead of embedding twice
const inFlight = new Map<string, Promise<PodcastEpisode>>();

export class IngestError extends Error {}

export function youtubeEpisodeId(videoId: string): string {
  return `yt-${videoId}`;
}

/**
 * Turn a YouTube link into a searchable episode: fetch captions, chunk, embed, save.
 * Returns the existing episode if this video was ingested before.
 */
export async function ingestYouTubeUrl(url: string): Promise<{ episode: PodcastEpisode; created: boolean }> {
  const videoId = parseYouTubeVideoId(url);
  if (!videoId) {
    throw new IngestError("That doesn't look like a YouTube video link");
  }

  const id = youtubeEpisodeId(videoId);
  const existing = getEpisodeById(id);
  if (existing) return { episode: existing, created: false };

  let pending = inFlight.get(id);
  if (!pending) {
    pending = buildEpisode(id, videoId).finally(() => inFlight.delete(id));
    inFlight.set(id, pending);
  }
  return { episode: await pending, created: true };
}

async function buildEpisode(id: string, videoId: string): Promise<PodcastEpisode> {
  let video;
  try {
    video = await fetchYouTubeVideo(videoId);
  } catch (err) {
    throw new IngestError(err instanceof Error ? err.message : "Couldn't fetch the video");
  }

  const chunks = chunkSegments(id, video.segments);
  const embeddings = await generateEmbeddings(chunks.map((c) => c.text));
  const lastChunk = chunks[chunks.length - 1];

  const episode: PodcastEpisode = {
    id,
    title: video.title,
    showTitle: video.author,
    host: video.author,
    guest: video.author,
    youtubeId: videoId,
    duration: video.lengthSeconds || lastChunk.endTime,
    suggestedQueries: GENERIC_QUERIES,
    chunks: chunks.map((chunk, i) => ({ ...chunk, embedding: embeddings[i] })),
  };

  saveLibraryEpisode(episode);
  // Chapters and overview take a while on Groq's free tier; build them in the background
  ensureSummary(episode);
  return episode;
}

/**
 * Group short caption lines into passages, preferring to break at sentence ends
 */
export function chunkSegments(episodeId: string, segments: CaptionSegment[]): TranscriptChunk[] {
  const chunks: TranscriptChunk[] = [];
  let current: CaptionSegment[] = [];

  const flush = (nextStart?: number) => {
    if (current.length === 0) return;
    const first = current[0];
    const last = current[current.length - 1];
    // Auto captions overlap, so end where the next passage begins when we know it
    const endTime = nextStart ?? last.start + last.duration;
    chunks.push({
      id: `${episodeId}-chunk-${chunks.length + 1}`,
      episodeId,
      startTime: Math.floor(first.start),
      endTime: Math.max(Math.floor(first.start), Math.floor(endTime) - 1),
      speaker: UNKNOWN_SPEAKER,
      text: current.map((s) => s.text).join(" "),
    });
    current = [];
  };

  for (const segment of segments) {
    if (current.length > 0) {
      const elapsed = segment.start - current[0].start;
      const previousText = current[current.length - 1].text;
      const atSentenceEnd = /[.?!]["')\]]?$/.test(previousText);
      if (elapsed >= MAX_CHUNK_SECONDS || (elapsed >= MIN_CHUNK_SECONDS && atSentenceEnd)) {
        flush(segment.start);
      }
    }
    current.push(segment);
  }
  flush();

  return chunks;
}
