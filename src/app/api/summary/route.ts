import { NextRequest, NextResponse } from "next/server";
import { getEpisodeById } from "@/lib/episodes";
import { ensureSummary, getSummaryStatus } from "@/lib/summary";

// GET ?episodeId=…  → current summary status (ready / running / error / none / unavailable)
export async function GET(req: NextRequest) {
  const episodeId = req.nextUrl.searchParams.get("episodeId");
  if (!episodeId || !getEpisodeById(episodeId)) {
    return NextResponse.json({ error: "Unknown episode" }, { status: 404 });
  }
  return NextResponse.json(getSummaryStatus(episodeId));
}

// POST { episodeId } → start summarizing in the background (no-op if ready or running)
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const { episodeId } = (body ?? {}) as Record<string, unknown>;
  const episode = typeof episodeId === "string" ? getEpisodeById(episodeId) : undefined;
  if (!episode) {
    return NextResponse.json({ error: "Unknown episode" }, { status: 404 });
  }
  return NextResponse.json(ensureSummary(episode));
}
