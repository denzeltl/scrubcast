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
 * Watch the video directly via the Gemini API using native YouTube URL input.
 * Gemini analyzes both visual frames and audio track.
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

  const requestBody = {
    systemInstruction: {
      parts: [
        {
          text: `You are Scrubcast's multimodal video and vision intelligence.
You have direct access to watch and listen to the YouTube video provided.
Your task is to provide a direct, sharp, and accurate answer to the user's question, understanding and building upon any conversation history.

CRITICAL RULES:
1. Ground your answer strictly in what actually occurs in the video — observing visual elements (screen demos, slides, diagrams, physical objects, actions, facial expressions) as well as spoken audio.
2. Every major observation, visual demonstration, or quote MUST include an inline citation chip formatted exactly like [MM:SS] or [HH:MM:SS] (e.g. [03:45] or [01:14:20]) indicating when that moment or visual is shown in the video.
3. Write concise, plain text paragraphs. Use **bold** sparingly; do NOT use markdown headings, tables, or numbered lists.
4. If something is not shown or mentioned in the video, state that plainly.`,
        },
      ],
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

  const normalizedModel = GEMINI_MODEL.trim().replace(/^models\//, "");
  const url = `${GEMINI_API_BASE}/${encodeURIComponent(normalizedModel)}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

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
  };
}
