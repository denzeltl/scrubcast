import fs from "fs";
import path from "path";
import Groq from "groq-sdk";
import { EpisodeSummary, PodcastEpisode, SummaryChapter, SummaryStatus, TranscriptChunk } from "@/types/podcast";
import { formatTimestamp, parseTimestampToSeconds } from "./time";

// Whole-video understanding. Retrieval only ever shows the answer model a handful of
// passages, which can't answer "what's the main argument?". So once per video we
// summarize the full transcript into chapters plus an overview, and every answer
// gets that summary as extra context.
//
// Groq's free tier caps each model at ~8k tokens/minute and rejects any single request
// above that, so a long transcript is summarized window by window ("map"), then the
// window notes are combined ("reduce"). It runs on its own model so its token budget
// doesn't slow down live questions.

export const SUMMARY_MODEL = process.env.GROQ_SUMMARY_MODEL || "openai/gpt-oss-20b";
const TOKENS_PER_MINUTE = Number(process.env.GROQ_SUMMARY_TPM) || 8000;
// Leave headroom under the cap for the prompt scaffold and output
const WINDOW_CHARS = 14000; // ~3.5k tokens of transcript per map call
const MAP_MAX_OUTPUT = 900;
const REDUCE_MAX_OUTPUT = 1800;

const SUMMARY_DIR = path.join(process.cwd(), "data", "summaries");

const groqApiKey = process.env.GROQ_API_KEY;
// The SDK honours retry-after on 429s; give it room to wait out a busy minute
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey, maxRetries: 6 }) : null;

type Job = { promise: Promise<void>; done: number; total: number; error?: string };

// Job state lives on globalThis, not in module scope: Next.js can load a separate copy
// of this module per route (and per dev reload), and /api/ingest, /api/summary and
// /api/search must all see the same running jobs and token budget.
const shared = ((globalThis as { __scrubcastSummary?: SharedState }).__scrubcastSummary ??= {
  cache: new Map(),
  jobs: new Map(),
  // One summary at a time: parallel jobs would just fight over the same token budget
  queue: Promise.resolve(),
  // Sliding one-minute window of tokens spent, so calls stay under the per-minute cap
  // instead of leaning on 429 retries
  spent: [],
} as SharedState);

interface SharedState {
  cache: Map<string, EpisodeSummary>;
  jobs: Map<string, Job>;
  queue: Promise<unknown>;
  spent: { at: number; tokens: number }[];
}

const summaryCache = shared.cache;
const jobs = shared.jobs;
const spent = shared.spent;

function summaryPath(episodeId: string): string {
  return path.join(SUMMARY_DIR, `${episodeId}.json`);
}

export function getSummary(episodeId: string): EpisodeSummary | undefined {
  const cached = summaryCache.get(episodeId);
  if (cached) return cached;
  if (!/^[A-Za-z0-9_-]+$/.test(episodeId)) return undefined;
  const file = summaryPath(episodeId);
  if (!fs.existsSync(file)) return undefined;
  const summary = JSON.parse(fs.readFileSync(file, "utf-8")) as EpisodeSummary;
  summaryCache.set(episodeId, summary);
  return summary;
}

export function getSummaryStatus(episodeId: string): SummaryStatus {
  const summary = getSummary(episodeId);
  if (summary) return { state: "ready", summary };
  const job = jobs.get(episodeId);
  if (!job) return { state: groq ? "none" : "unavailable" };
  if (job.error) return { state: "error", error: job.error };
  return { state: "running", done: job.done, total: job.total };
}

/**
 * Start summarizing an episode in the background if it isn't summarized or running yet.
 * A failed job is retried on the next call.
 */
export function ensureSummary(episode: PodcastEpisode): SummaryStatus {
  const status = getSummaryStatus(episode.id);
  if (status.state === "ready" || status.state === "running" || status.state === "unavailable") {
    return status;
  }

  const windows = splitIntoWindows(episode.chunks);
  const job: Job = {
    promise: Promise.resolve(),
    done: 0,
    total: windows.length + 1,
  };
  const run = shared.queue.then(() => buildSummary(episode, windows, job));
  // Keep the queue alive after a failure so later jobs still run
  shared.queue = run.catch(() => undefined);
  job.promise = run
    .then(() => {
      jobs.delete(episode.id);
    })
    .catch((err: unknown) => {
      console.error(`Summary failed for ${episode.id}:`, err);
      job.error = err instanceof Error ? err.message : "Summary failed";
    });
  jobs.set(episode.id, job);
  return { state: "running", done: 0, total: job.total };
}

function splitIntoWindows(chunks: TranscriptChunk[]): TranscriptChunk[][] {
  const windows: TranscriptChunk[][] = [];
  let current: TranscriptChunk[] = [];
  let size = 0;
  for (const chunk of chunks) {
    if (current.length > 0 && size + chunk.text.length > WINDOW_CHARS) {
      windows.push(current);
      current = [];
      size = 0;
    }
    current.push(chunk);
    size += chunk.text.length + 16;
  }
  if (current.length > 0) windows.push(current);
  return windows;
}

const formatPassages = (chunks: TranscriptChunk[]) =>
  chunks.map((c) => `[${formatTimestamp(c.startTime)}] ${c.speaker}: ${c.text}`).join("\n");

interface WindowNotes {
  chapters: { start: string; title: string; summary: string }[];
  claims: { time: string; text: string }[];
}

async function buildSummary(
  episode: PodcastEpisode,
  windows: TranscriptChunk[][],
  progress: { done: number }
): Promise<void> {
  if (!groq) throw new Error("GROQ_API_KEY is not set");

  // Map: chapters and notable claims per window
  const chapters: SummaryChapter[] = [];
  const claims: { seconds: number; text: string }[] = [];

  for (const window of windows) {
    const notes = await completeJson<WindowNotes>(
      `You are outlining one section of a long video transcript titled "${episode.title}".
Return JSON: {"chapters":[{"start":"<timestamp copied from a passage>","title":"<3-7 words>","summary":"<1-2 sentences>"}],"claims":[{"time":"<timestamp>","text":"<one notable claim, opinion or fact, with who said it if known>"}]}
Split this section into 1-3 chapters where the topic changes. Give 2-4 claims. Copy timestamps exactly from the passages.`,
      formatPassages(window),
      MAP_MAX_OUTPUT
    );

    for (const ch of notes.chapters ?? []) {
      if (!ch?.title) continue;
      chapters.push({
        startTime: snapToChunkStart(ch.start, window),
        title: ch.title.trim(),
        summary: (ch.summary ?? "").trim(),
      });
    }
    for (const claim of notes.claims ?? []) {
      if (claim?.text) claims.push({ seconds: snapToChunkStart(claim.time, window), text: claim.text.trim() });
    }
    progress.done++;
  }

  chapters.sort((a, b) => a.startTime - b.startTime);
  const uniqueChapters = chapters.filter((ch, i) => i === 0 || ch.startTime !== chapters[i - 1].startTime);

  // Reduce: the whole-video view, from the chapter outline and claims
  const outline = uniqueChapters
    .map((ch) => `[${formatTimestamp(ch.startTime)}] ${ch.title}: ${ch.summary}`)
    .join("\n");
  const claimList = claims.map((c) => `[${formatTimestamp(c.seconds)}] ${c.text}`).join("\n");

  const whole = await completeJson<{
    overview: string;
    mainArgument: string;
    keyPoints: { time: string; text: string }[];
  }>(
    `You are summarizing a whole video, "${episode.title}" by ${episode.showTitle}, from its chapter outline and notable claims.
Return JSON: {"overview":"<3-5 sentences: who is talking, what about, how it flows>","mainArgument":"<2-3 sentences: the central thesis or throughline; if it's a wide-ranging conversation, say so and name the recurring themes>","keyPoints":[{"time":"<timestamp copied from the input>","text":"<one sentence>"}]}
Give 5-8 key points spread across the video. Use only what's in the input.`,
    `CHAPTERS\n${outline}\n\nCLAIMS\n${claimList}`,
    REDUCE_MAX_OUTPUT
  );
  progress.done++;

  const allChunks = episode.chunks;
  const summary: EpisodeSummary = {
    overview: (whole.overview ?? "").trim(),
    mainArgument: (whole.mainArgument ?? "").trim(),
    keyPoints: (whole.keyPoints ?? [])
      .filter((p) => p?.text)
      .map((p) => ({ seconds: snapToChunkStart(p.time, allChunks), text: p.text.trim() })),
    chapters: uniqueChapters,
    model: SUMMARY_MODEL,
    createdAt: new Date().toISOString(),
  };

  fs.mkdirSync(SUMMARY_DIR, { recursive: true });
  fs.writeFileSync(summaryPath(episode.id), JSON.stringify(summary, null, 2), "utf-8");
  summaryCache.set(episode.id, summary);
}

async function waitForBudget(estimatedTokens: number): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (spent.length > 0 && now - spent[0].at > 60_000) spent.shift();
    const used = spent.reduce((sum, s) => sum + s.tokens, 0);
    if (used + estimatedTokens <= TOKENS_PER_MINUTE || spent.length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 60_000 - (now - spent[0].at) + 250));
  }
}

async function completeJson<T>(instructions: string, input: string, maxOutput: number): Promise<T> {
  if (!groq) throw new Error("GROQ_API_KEY is not set");
  const estimated = Math.ceil((instructions.length + input.length) / 3.5) + maxOutput;
  await waitForBudget(estimated);

  const completion = await groq.chat.completions.create({
    model: SUMMARY_MODEL,
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: input },
    ],
    temperature: 0.2,
    max_completion_tokens: maxOutput,
    response_format: { type: "json_object" },
    ...(SUMMARY_MODEL.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" as const } : {}),
  });
  spent.push({ at: Date.now(), tokens: completion.usage?.total_tokens ?? estimated });

  const content = completion.choices[0]?.message?.content ?? "";
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(`Summary model returned invalid JSON: ${content.slice(0, 120)}`);
  }
}

/**
 * Map a model-written timestamp onto the start of the passage it most likely means
 */
function snapToChunkStart(raw: string | undefined, chunks: TranscriptChunk[]): number {
  const cleaned = (raw ?? "").replace(/[^\d:]/g, "");
  if (!cleaned) return chunks[0].startTime;

  // A two-part stamp may be MM:SS or a truncated HH:MM; use whichever lands closer
  const parts = cleaned.split(":").map(Number);
  const readings = [parseTimestampToSeconds(cleaned)];
  if (parts.length === 2) readings.push(parts[0] * 3600 + parts[1] * 60);

  let best = chunks[0];
  let bestDistance = Infinity;
  for (const seconds of readings) {
    for (const c of chunks) {
      const distance = Math.abs(c.startTime - seconds);
      if (distance < bestDistance) {
        best = c;
        bestDistance = distance;
      }
    }
  }
  return best.startTime;
}
