import { PodcastEpisode, TranscriptChunk } from "@/types/podcast";
import { generateEmbeddings } from "./embeddings";
import { getEpisodeById, saveLibraryEpisode } from "./episodes";
import { ensureSummary } from "./summary";
import { CaptionSegment, fetchYouTubeVideo, fetchYouTubeOEmbed, parseYouTubeVideoId, YouTubeBlockedError } from "./youtube";
import { hasGeminiKey } from "./gemini";

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

const MAX_VIDEO_MINUTES = Number(process.env.MAX_VIDEO_MINUTES) || 60;
const MAX_CONCURRENT_INGESTS = Number(process.env.MAX_CONCURRENT_INGESTS) || 2;

// Two clicks on the same link share one ingest instead of embedding twice
const inFlight = new Map<string, Promise<PodcastEpisode>>();

export class IngestError extends Error {
  // "youtube_blocked" when YouTube refused this server, so the UI can suggest running locally
  constructor(message: string, readonly code?: "youtube_blocked") {
    super(message);
  }
}

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
    // Embedding is CPU-bound; a pile of parallel ingests would stall every request
    if (inFlight.size >= MAX_CONCURRENT_INGESTS) {
      throw new IngestError("Scrubcast is indexing other videos right now. Try again in a minute.");
    }
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
    if (err instanceof YouTubeBlockedError) {
      // If hosted on a cloud server like Render and blocked by YouTube,
      // fallback to public oEmbed metadata so Gemini Vision can watch it directly
      if (hasGeminiKey()) {
        return buildVisionOnlyEpisode(id, videoId);
      }
      throw new IngestError(
        "YouTube blocks this public server from fetching captions, so pasted links only work when you run Scrubcast yourself (or configure GEMINI_API_KEY to watch videos with Gemini Vision).",
        "youtube_blocked"
      );
    }
    throw new IngestError(err instanceof Error ? err.message : "Couldn't fetch the video");
  }

  // Long videos cost the most CPU and summary tokens; cap them on a public server
  if (video.lengthSeconds > MAX_VIDEO_MINUTES * 60) {
    throw new IngestError(
      `This video is ${Math.round(video.lengthSeconds / 60)} minutes long. Scrubcast handles videos up to ${MAX_VIDEO_MINUTES} minutes.`
    );
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
    hasCaptions: video.captionLanguage !== "none",
    chunks: chunks.map((chunk, i) => ({ ...chunk, embedding: embeddings[i] })),
  };

  saveLibraryEpisode(episode);
  // Chapters and overview take a while on Groq's free tier; build them in the background
  if (episode.hasCaptions !== false) {
    ensureSummary(episode);
  }
  return episode;
}

/**
 * Fallback episode builder when cloud datacenter IPs are blocked from fetching captions.
 * Uses public oEmbed for metadata and enables Gemini Vision to answer all questions.
 */
async function buildVisionOnlyEpisode(id: string, videoId: string): Promise<PodcastEpisode> {
  const oembed = await fetchYouTubeOEmbed(videoId);
  const placeholderText = `Video: ${oembed.title} by ${oembed.author}. This video was ingested without server-side captions. Questions are answered by watching visual frames and audio directly with Gemini Vision.`;

  const dummyChunk: TranscriptChunk = {
    id: `${id}-chunk-1`,
    episodeId: id,
    startTime: 0,
    endTime: 3600,
    speaker: oembed.author,
    text: placeholderText,
  };

  const embeddings = await generateEmbeddings([placeholderText]);

  const episode: PodcastEpisode = {
    id,
    title: oembed.title,
    showTitle: oembed.author,
    host: oembed.author,
    guest: oembed.author,
    youtubeId: videoId,
    duration: 3600,
    coverImage: oembed.thumbnailUrl,
    hasCaptions: false,
    suggestedQueries: [
      "What is shown in this video?",
      "Summarize the main visual demonstrations",
      "What is the presenter explaining on screen?",
    ],
    chunks: [
      {
        ...dummyChunk,
        embedding: embeddings[0],
      },
    ],
  };

  saveLibraryEpisode(episode);
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
