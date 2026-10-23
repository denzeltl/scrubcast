import Groq from "groq-sdk";
import { Citation, SearchMatch } from "@/types/podcast";
import { formatTimestamp, parseTimestampToSeconds } from "./time";

const groqApiKey = process.env.GROQ_API_KEY;

export const groq = groqApiKey
  ? new Groq({
      apiKey: groqApiKey,
    })
  : null;

export async function synthesizeAnswer(
  query: string,
  matches: SearchMatch[]
): Promise<{
  answer: string;
  citations: Citation[];
  latencyMs: number;
  isFallback: boolean;
}> {
  const t0 = Date.now();

  // If no Groq API Key is provided, use high-fidelity deterministic grounded synthesizer
  if (!groq) {
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

  const systemPrompt = `You are Scrubcast's sub-second audio synthesis intelligence.
Your task is to provide a direct, razor-sharp, grounded answer to the user's question using ONLY the provided podcast transcript excerpts.

CRITICAL CITATION RULES:
1. Every major statement or insight MUST include an inline citation chip formatted strictly as [MM:SS] matching the speaker's start time from the sources (e.g., [03:45]).
2. Only use timestamps that appear in the sources. Copy them exactly as written.
3. Attribute quotes and perspectives to the speaker named in the source.
4. Do NOT make up facts not found in the context. If the excerpts don't answer the question, say so plainly.
5. Keep the synthesis concise, punchy, and structured for audio seekers.`;

  const userPrompt = `Question: "${query}"

Retrieved Podcast Excerpts:
${contextString}

Synthesize a grounded answer with [MM:SS] citation chips:`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      max_tokens: 600,
    });

    const answer =
      chatCompletion.choices[0]?.message?.content ||
      "Unable to synthesize answer from retrieved context.";
    const citations = extractCitationsFromText(answer, matches);

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
