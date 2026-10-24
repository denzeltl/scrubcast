import { NextRequest, NextResponse } from "next/server";
import { IngestError, ingestYouTubeUrl } from "@/lib/ingest";
import { stripEmbeddings } from "@/lib/episodes";
import { checkRateLimit, LIMITS } from "@/lib/rateLimit";

// Long videos take a while to embed on CPU
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, LIMITS.ingest);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const { url } = (body ?? {}) as Record<string, unknown>;
  if (typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ error: "A YouTube link is required" }, { status: 400 });
  }

  const t0 = Date.now();
  try {
    const { episode, created } = await ingestYouTubeUrl(url);
    return NextResponse.json({
      episode: stripEmbeddings(episode),
      created,
      latencyMs: Date.now() - t0,
    });
  } catch (error: unknown) {
    if (error instanceof IngestError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    }
    // Details stay in the server log; visitors get a message they can act on
    console.error("Ingest route error:", error);
    return NextResponse.json(
      { error: "Something went wrong indexing that video. Please try again." },
      { status: 500 }
    );
  }
}
