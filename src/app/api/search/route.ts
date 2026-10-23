import { NextRequest, NextResponse } from "next/server";
import { searchEpisodeChunks } from "@/lib/search";
import { GROQ_MODEL, synthesizeAnswer } from "@/lib/groq";
import { getEpisodeById } from "@/lib/episodes";
import { getSummary } from "@/lib/summary";
import { checkRateLimit, LIMITS } from "@/lib/rateLimit";
import { SearchResult } from "@/types/podcast";

const MAX_QUERY_LENGTH = 500;

export async function POST(req: NextRequest) {
  const tTotalStart = Date.now();

  const limited = checkRateLimit(req, LIMITS.search);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const { query: rawQuery, episodeId } = (body ?? {}) as Record<string, unknown>;
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";

  if (!query) {
    return NextResponse.json(
      { error: "Query string is required" },
      { status: 400 }
    );
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `Query must be ${MAX_QUERY_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  if (!episodeId || typeof episodeId !== "string") {
    return NextResponse.json(
      { error: "Episode ID is required" },
      { status: 400 }
    );
  }

  const episode = getEpisodeById(episodeId);
  if (!episode) {
    return NextResponse.json(
      { error: `Episode not found: ${episodeId}` },
      { status: 404 }
    );
  }
  // Present once the background summary job has finished for this video
  const summary = getSummary(episodeId);

  try {
    // 1. Vector Search via local Xenova bge-small-en-v1.5
    const { matches, embeddingLatencyMs, searchLatencyMs } =
      await searchEpisodeChunks(query, episodeId, 5);

    // 2. Groq Cloud grounded synthesis
    const { answer, citations, latencyMs: synthesisLatencyMs, isFallback } =
      await synthesizeAnswer(query, matches, summary, episode.duration);

    const totalLatency = Date.now() - tTotalStart;

    const result: SearchResult = {
      query,
      answer,
      citations,
      // Embeddings are only needed server-side; don't ship 384 floats per match to the browser
      topChunks: matches.map((m) => ({
        ...m,
        chunk: { ...m.chunk, embedding: undefined },
      })),
      latencyMs: {
        embedding: embeddingLatencyMs,
        search: searchLatencyMs,
        synthesis: synthesisLatencyMs,
        total: totalLatency,
      },
      isFallbackGroq: isFallback,
      model: GROQ_MODEL,
      usedSummary: Boolean(summary) && !isFallback,
    };

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Search route error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error during search",
      },
      { status: 500 }
    );
  }
}
