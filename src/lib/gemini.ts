import { ChatHistoryItem, Citation } from "@/types/podcast";
import { parseTimestampToSeconds } from "./time";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getGeminiKey(): string | null {
  return process.env.GEMINI_API_KEY?.trim() || null;
}

const SYSTEM_INSTRUCTION = `You are Scrubcast's multimodal video and vision intelligence.
You have direct access to watch and listen to the YouTube video provided.
Your task is to provide a direct, sharp, and accurate answer to the user's question, understanding and building upon any conversation history.

CRITICAL RULES:
1. Ground your answer strictly in what actually occurs in the video — observing visual elements (screen demos, slides, diagrams, physical objects, actions, facial expressions) as well as spoken audio.
2. Every major observation, visual demonstration, or quote MUST include an inline citation chip formatted exactly like [MM:SS] or [HH:MM:SS] (e.g. [03:45] or [01:14:20]) indicating when that moment or visual is shown in the video.
3. Write concise, plain text paragraphs. Use **bold** sparingly; do NOT use markdown headings, tables, or numbered lists.
4. If something is not shown or mentioned in the video, state that plainly.`;

interface CachedVideoEntry {
  cacheName: string;
  expiresAt: number;
}

// Persistent across route module instances in Next.js
const globalCaches = ((globalThis as { __geminiVideoCaches?: Map<string, Promise<string | null> | CachedVideoEntry> })
  .__geminiVideoCaches ??= new Map());

export function clearVideoCache(youtubeId: string): void {
  globalCaches.delete(youtubeId);
}

export function isCachedVideo(youtubeId: string): boolean {
  const existing = globalCaches.get(youtubeId);
  return Boolean(existing && "cacheName" in existing && (existing as CachedVideoEntry).expiresAt > Date.now());
}

/**
 * Gets an active Gemini context cache for this YouTube video, or creates one.
 * Cached video tokens avoid re-processing/re-watching the video on subsequent questions,
 * cutting response latency from ~15s to ~1-2s and saving ~75% on token costs.
 */
export async function getOrCreateVideoCache(
  youtubeId: string,
  model: string,
  apiKey: string
): Promise<string | null> {
  const existing = globalCaches.get(youtubeId);
  if (existing && "cacheName" in existing && (existing as CachedVideoEntry).expiresAt > Date.now() + 60_000) {
    return (existing as CachedVideoEntry).cacheName;
  }
  if (existing && "then" in existing) {
    return (existing as Promise<string | null>);
  }

  const createPromise = (async (): Promise<string | null> => {
    try {
      const normalizedModel = model.trim().replace(/^models\//, "");
      const url = `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${normalizedModel}`,
          ttl: "3600s",
          contents: [
            {
              role: "user",
              parts: [
                {
                  fileData: {
                    fileUri: `https://www.youtube.com/watch?v=${youtubeId}`,
                  },
                },
              ],
            },
          ],
          systemInstruction: {
            parts: [
              {
                text: SYSTEM_INSTRUCTION,
              },
            ],
          },
        }),
      });

      if (!res.ok) {
        // Fall back gracefully to direct inline video querying if caching is not supported (e.g. video < 32k tokens)
        return null;
      }

      const data = await res.json();
      const cacheName = data?.name;
      if (!cacheName || typeof cacheName !== "string") {
        return null;
      }

      const expiresAt = data?.expireTime ? new Date(data.expireTime).getTime() : Date.now() + 3500_000;
      globalCaches.set(youtubeId, { cacheName, expiresAt });
      return cacheName;
    } catch {
      return null;
    }
  })();

  globalCaches.set(youtubeId, createPromise);
  const result = await createPromise;
  if (!result) {
    globalCaches.delete(youtubeId);
  }
  return result;
}

/**
 * Parses [MM:SS] or [HH:MM:SS] citations out of text produced by Gemini Vision,
 * mapping each timestamp to a structured citation that the player can seek to.
 */
export function extractVisionCitations(text: string): Citation[] {
  const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
  const citations: Citation[] = [];
  const seen = new Set<string>();

  // Split into sentences / paragraphs so we can associate each timestamp with its local context
  const segments = text.split(/(?<=[.!?\n])\s+/);

  for (const seg of segments) {
    let match: RegExpExecArray | null;
    timestampRegex.lastIndex = 0;
    while ((match = timestampRegex.exec(seg)) !== null) {
      const timestamp = match[1];
      if (seen.has(timestamp)) continue;
      seen.add(timestamp);

      const seconds = parseTimestampToSeconds(timestamp);
      // Clean snippet for footnote preview
      const snippet = seg
        .replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, "")
        .replace(/^\s*(?:At|Around|In|During|See|Notice)\s*,?\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();

      citations.push({
        timestamp,
        seconds,
        speaker: "Video Moment",
        chunkId: `vision-${timestamp}`,
        snippet: snippet || `Video moment at [${timestamp}]`,
      });
    }
  }

  // Catch any remaining timestamps that might have been skipped in splitting
  timestampRegex.lastIndex = 0;
  let leftoverMatch: RegExpExecArray | null;
  while ((leftoverMatch = timestampRegex.exec(text)) !== null) {
    const timestamp = leftoverMatch[1];
    if (!seen.has(timestamp)) {
      seen.add(timestamp);
      const seconds = parseTimestampToSeconds(timestamp);
      citations.push({
        timestamp,
        seconds,
        speaker: "Video Moment",
        chunkId: `vision-${timestamp}`,
        snippet: `Video moment at [${timestamp}]`,
      });
    }
  }

  return citations.sort((a, b) => a.seconds - b.seconds);
}

/**
 * Watch the video via the Gemini API using native YouTube URL input.
 * Utilizes Context Caching so subsequent questions don't re-watch the video from scratch.
 */
export async function watchAndSynthesizeAnswer(
  query: string,
  youtubeId: string,
  videoDuration?: number,
  history: ChatHistoryItem[] = []
): Promise<{
  answer: string;
  citations: Citation[];
  latencyMs: number;
  model: string;
  isCached?: boolean;
}> {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Add your Gemini key to .env.local to use Vision mode.");
  }

  const t0 = Date.now();
  const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

  // Build prompt with conversation history context
  let userText = "";
  if (history.length > 0) {
    userText += "Conversation history:\n";
    for (const item of history.slice(-4)) {
      if (item.query && item.answer) {
        userText += `User: ${item.query}\nAssistant: ${item.answer}\n\n`;
      }
    }
  }
  userText += `Question about the video: "${query}"\n\nPlease answer by watching and listening to the video. Cite relevant visual or audio moments using [MM:SS] or [HH:MM:SS] timestamp chips.`;

  const normalizedModel = GEMINI_MODEL.trim().replace(/^models\//, "");

  // Try to use or establish context cache for this video
  const cachedContent = await getOrCreateVideoCache(youtubeId, normalizedModel, apiKey);

  let requestBody: Record<string, unknown>;

  if (cachedContent) {
    requestBody = {
      cachedContent,
      contents: [
        {
          role: "user",
          parts: [{ text: userText }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    };
  } else {
    requestBody = {
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: youtubeUrl,
              },
            },
            {
              text: userText,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    };
  }

  const url = `${GEMINI_API_BASE}/${encodeURIComponent(normalizedModel)}:generateContent?key=${apiKey}`;

  let res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  // If cached content returns 404 (e.g. cache expired early or was evicted), fallback once to direct call
  if (!res.ok && cachedContent && res.status === 404) {
    clearVideoCache(youtubeId);
    const directRequestBody = {
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: youtubeUrl,
              },
            },
            {
              text: userText,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    };
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(directRequestBody),
    });
  }

  const latencyMs = Date.now() - t0;

  if (!res.ok) {
    let errorMsg = `Gemini API returned ${res.status}`;
    try {
      const errData = await res.json();
      if (errData?.error?.message) {
        errorMsg = errData.error.message;
      }
    } catch {
      // Keep default status message
    }
    throw new Error(errorMsg);
  }

  const data = await res.json();
  const rawAnswer = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawAnswer || typeof rawAnswer !== "string") {
    throw new Error("Gemini returned an empty response for this video.");
  }

  const citations = extractVisionCitations(rawAnswer);

  return {
    answer: rawAnswer.trim(),
    citations,
    latencyMs,
    model: GEMINI_MODEL,
    isCached: Boolean(cachedContent),
  };
}
