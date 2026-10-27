import { NextResponse } from "next/server";
import { getAllEpisodes } from "@/lib/episodes";
import { hasGroqKey } from "@/lib/groqKeys";
import { warmEmbeddingPipeline, isEmbeddingReady } from "@/lib/embeddings";

// For the host's uptime checks and the Docker HEALTHCHECK. Says whether the server is up
// and configured; it doesn't call Groq or YouTube, so it's cheap to hit often.
// Asynchronously triggers embedding warm-up in the background so cold starts are eliminated
// before user requests arrive.
export const dynamic = "force-dynamic";

export function GET() {
  // Fire-and-forget: warm the local vector pipeline in the background
  void warmEmbeddingPipeline();

  return NextResponse.json({
    ok: true,
    modelReady: isEmbeddingReady(),
    featuredVideos: getAllEpisodes().length,
    answers: hasGroqKey() ? "groq" : "quotes-only (no GROQ_API_KEY)",
  });
}
