import { Citation, EpisodeSummary, SearchMatch } from "@/types/podcast";
import { createChatCompletion, hasGroqKey } from "./groqKeys";
import { formatTimestamp, parseTimestampToSeconds } from "./time";

// Groq retires models without much notice (llama-3.3-70b-versatile is gone), so the
// model is overridable. List what your key can use: GET https://api.groq.com/openai/v1/models
export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

export async function synthesizeAnswer(
  query: string,
  matches: SearchMatch[],
  // Whole-video chapters and overview, when they've been generated
  summary?: EpisodeSummary,
  episodeDuration?: number
): Promise<{
  answer: string;
  citations: Citation[];
  latencyMs: number;
  isFallback: boolean;
}> {
  const t0 = Date.now();

  // If no Groq API Key is provided, use high-fidelity deterministic grounded synthesizer
  if (!hasGroqKey()) {
    const fallbackResult = createFallbackSynthesis(query, matches);
    return {
      answer: fallbackResult.answer,
      citations: fallbackResult.citations,
      latencyMs: Date.now() - t0,
      isFallback: true,
    };
  }

  // Format context chunks with explicit [MM:SS] tags
  const contextString = matches
    .map((m, idx) => {
      const timecode = formatTimestamp(m.chunk.startTime);
      return `[Source ${idx + 1}] (${timecode}) ${m.chunk.speaker}: "${m.chunk.text}"`;
    })
    .join("\n\n");

  const summaryString = summary ? formatSummaryForPrompt(summary) : "";
  // Chapters and key points are citable too, so citations can snap to them
  const citable = summary ? [...matches, ...summaryAnchors(summary, episodeDuration)] : matches;

  const systemPrompt = `You are Scrubcast's sub-second audio synthesis intelligence.
Your task is to provide a direct, razor-sharp, grounded answer to the user's question using ONLY the provided material: ${
    summary ? "a summary of the whole video (overview, main argument, key points, chapters) and " : ""
  }transcript excerpts retrieved for this question.
${
  summary
    ? "Use the summary for broad questions about the whole video (main argument, themes, structure, what's covered). Use the excerpts for specifics and quotes. Combine both when useful.\n"
    : ""
}

CRITICAL CITATION RULES:
1. Every major statement or insight MUST include an inline citation chip copied exactly from the source it relies on, e.g. [03:45] or [01:36:42]. Keep the hours when a source has them.
2. Only use timestamps that appear in the sources. Copy them exactly as written.
3. Attribute quotes and perspectives to the speaker named in the source.
4. Do NOT make up facts not found in the context. If the excerpts don't answer the question, say so plainly.
5. Keep the synthesis concise, punchy, and structured for audio seekers.
6. Write plain text paragraphs. Use **bold** sparingly; no headings, tables or lists.`;

  const userPrompt = `Question: "${query}"

${summaryString ? `Whole-Video Summary:\n${summaryString}\n\n` : ""}Retrieved Podcast Excerpts:
${contextString}

Synthesize a grounded answer with [MM:SS] citation chips:`;

  try {
    // Falls over to GROQ_API_KEY_BACKUP if the primary key is rejected or rate-limited
    const chatCompletion = await createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: GROQ_MODEL,
      temperature: 0.2,
      // gpt-oss reasons before answering and those tokens count against this limit,
      // so leave room; "low" keeps answers fast for a search box
      max_completion_tokens: 2000,
      ...(GROQ_MODEL.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" as const } : {}),
    });

    const answer = snapCitationsToSources(
      chatCompletion.choices[0]?.message?.content ||
        "Unable to synthesize answer from retrieved context.",
      citable
    );
    const citations = extractCitationsFromText(answer, citable);

    return {
      answer,
      citations,
      latencyMs: Date.now() - t0,
      isFallback: false,
    };
  } catch (error) {
    console.error("Groq Cloud API error, switching to grounded fallback:", error);
    const fallbackResult = createFallbackSynthesis(query, matches);
    return {
      answer: fallbackResult.answer,
      citations: fallbackResult.citations,
      latencyMs: Date.now() - t0,
      isFallback: true,
    };
  }
}

function formatSummaryForPrompt(summary: EpisodeSummary): string {
  const lines = [
    `Overview: ${summary.overview}`,
    `Main argument: ${summary.mainArgument}`,
    "Key points:",
    ...summary.keyPoints.map((p) => `- [${formatTimestamp(p.seconds)}] ${p.text}`),
    // Titles only: the answer model shares an ~8k tokens/minute budget with every question
    "Chapters:",
    ...summary.chapters.map((c) => `- [${formatTimestamp(c.startTime)}] ${c.title}`),
  ];
  return lines.join("\n");
}

/**
 * Chapters and key points as pseudo-passages, so citations of them snap and resolve
 */
function summaryAnchors(summary: EpisodeSummary, episodeDuration = Infinity): SearchMatch[] {
  const chapterAnchors = summary.chapters.map((c, i) => ({
    score: 0,
    chunk: {
      id: `chapter-${i + 1}`,
      episodeId: "",
      startTime: c.startTime,
      endTime: (summary.chapters[i + 1]?.startTime ?? episodeDuration) - 1,
      speaker: "Chapter",
      text: `${c.title}: ${c.summary}`,
    },
  }));
  const pointAnchors = summary.keyPoints.map((p, i) => ({
    score: 0,
    chunk: {
      id: `point-${i + 1}`,
      episodeId: "",
      startTime: p.seconds,
      endTime: p.seconds + 30,
      speaker: "Key point",
      text: p.text,
    },
  }));
  // Key points first: they're more specific than a whole chapter
  return [...pointAnchors, ...chapterAnchors];
}

/**
 * Rewrite every [timestamp] in the answer to the start time of the retrieved passage it
 * refers to. Models shorten [01:36:42] to [01:36], which would otherwise seek to 1m36s,
 * and occasionally cite a time inside a passage rather than its start.
 */
export function snapCitationsToSources(text: string, matches: SearchMatch[]): string {
  // gpt-oss often writes citations with full-width brackets: 【01:32:24】
  const normalized = text.replace(/【\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*】/g, "[$1]");
  if (matches.length === 0) return normalized;

  return normalized.replace(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g, (_tag, raw: string) => {
    const asWritten = parseTimestampToSeconds(raw);
    const chunks = matches.map((m) => m.chunk);

    // 1. The time as written falls inside a passage
    let target = chunks.find((c) => asWritten >= c.startTime && asWritten <= c.endTime);

    // 2. A two-part tag that is really a truncated HH:MM: the passage starts within that minute
    const parts = raw.split(":").map(Number);
    if (!target && parts.length === 2) {
      const minuteStart = parts[0] * 3600 + parts[1] * 60;
      target = chunks.find(
        (c) => c.startTime <= minuteStart + 59 && c.endTime >= minuteStart
      );
    }

    // 3. Otherwise the passage closest to the time as written
    if (!target) {
      const distance = (c: (typeof chunks)[number]) =>
        Math.min(Math.abs(c.startTime - asWritten), Math.abs(c.endTime - asWritten));
      target = chunks.reduce((best, c) => (distance(c) < distance(best) ? c : best));
    }

    return `[${formatTimestamp(target.startTime)}]`;
  });
}

/**
 * Extracts [MM:SS] or [HH:MM:SS] citation chips from synthesized response
 */
export function extractCitationsFromText(
  text: string,
  matches: SearchMatch[]
): Citation[] {
  const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
  const citations: Citation[] = [];
  const seenTimestamps = new Set<string>();

  let match;
  while ((match = timestampRegex.exec(text)) !== null) {
    const rawTag = match[1];
    if (seenTimestamps.has(rawTag)) continue;
    seenTimestamps.add(rawTag);

    const seconds = parseTimestampToSeconds(rawTag);

    // Find the closest chunk
    let closestChunk = matches[0]?.chunk;
    let minDiff = Infinity;

    for (const m of matches) {
      const diff = Math.abs(m.chunk.startTime - seconds);
      if (diff < minDiff) {
        minDiff = diff;
        closestChunk = m.chunk;
      }
    }

    if (closestChunk) {
      citations.push({
        timestamp: rawTag,
        seconds,
        speaker: closestChunk.speaker,
        chunkId: closestChunk.id,
        snippet: toSnippet(closestChunk.text),
      });
    }
  }

  // If the model didn't output any brackets, inject the top matches as citations
  if (citations.length === 0 && matches.length > 0) {
    matches.slice(0, 3).forEach((m) => {
      citations.push({
        timestamp: formatTimestamp(m.chunk.startTime),
        seconds: m.chunk.startTime,
        speaker: m.chunk.speaker,
        chunkId: m.chunk.id,
        snippet: toSnippet(m.chunk.text),
      });
    });
  }

  return citations;
}

/**
 * High-fidelity fallback synthesis when Groq key is pending in local development
 */
function createFallbackSynthesis(
  query: string,
  matches: SearchMatch[]
): { answer: string; citations: Citation[] } {
  if (matches.length === 0) {
    return {
      answer: "No relevant transcript sections found for this query in the selected episode.",
      citations: [],
    };
  }

  const primary = matches[0].chunk;
  const secondary = matches[1]?.chunk;
  const time1 = formatTimestamp(primary.startTime);
  const time2 = secondary ? formatTimestamp(secondary.startTime) : null;

  let answer = `${primary.speaker} addresses this at [${time1}]: "${primary.text}"`;
  if (secondary && time2) {
    answer += `\n\nAdditionally, at [${time2}], ${secondary.speaker} emphasizes: "${secondary.text}"`;
  }

  const citations: Citation[] = [
    {
      timestamp: time1,
      seconds: primary.startTime,
      speaker: primary.speaker,
      chunkId: primary.id,
      snippet: toSnippet(primary.text),
    },
  ];

  if (secondary && time2) {
    citations.push({
      timestamp: time2,
      seconds: secondary.startTime,
      speaker: secondary.speaker,
      chunkId: secondary.id,
      snippet: toSnippet(secondary.text),
    });
  }

  return { answer, citations };
}

function toSnippet(text: string, maxLength = 120): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}
