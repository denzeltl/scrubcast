import { NextResponse } from "next/server";
import { getAllEpisodes } from "@/lib/episodes";
import { hasGroqKey } from "@/lib/groqKeys";

// For the host's uptime checks and the Docker HEALTHCHECK. Says whether the server is up
// and configured; it doesn't call Groq or YouTube, so it's cheap to hit often.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    featuredVideos: getAllEpisodes().length,
    answers: hasGroqKey() ? "groq" : "quotes-only (no GROQ_API_KEY)",
  });
}
