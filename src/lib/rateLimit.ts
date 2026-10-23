import { NextRequest, NextResponse } from "next/server";

// Per-visitor limits so one person can't spend the whole Groq budget (or the CPU,
// for indexing) and take the site down for everyone. In memory, so limits reset on
// restart and apply per server instance; that's fine for a single small server.

interface Limit {
  name: string;
  max: number;
  windowMs: number;
}

export const LIMITS = {
  // Indexing a video: CPU for embeddings + Groq tokens for the summary
  ingest: {
    name: "ingest",
    max: Number(process.env.RATE_LIMIT_INGEST_PER_HOUR) || 5,
    windowMs: 60 * 60_000,
  },
  // Asking a question: one Groq call each
  search: {
    name: "search",
    max: Number(process.env.RATE_LIMIT_SEARCH_PER_10_MIN) || 30,
    windowMs: 10 * 60_000,
  },
} satisfies Record<string, Limit>;

const hits: Map<string, number[]> = ((
  globalThis as { __scrubcastRateLimits?: Map<string, number[]> }
).__scrubcastRateLimits ??= new Map<string, number[]>());

// How many proxies in front of the app append to x-forwarded-for (1 for a typical
// host's load balancer). Raise it if the host chains more.
const TRUSTED_PROXY_HOPS = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);

/**
 * The visitor's IP. Each trusted proxy appends the address it saw to the end of
 * x-forwarded-for, so the real client is counted from the right. Entries further left
 * come from the visitor's own request and can be forged to dodge limits.
 */
function clientId(req: NextRequest): string {
  const chain = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
  if (chain.length > 0) return chain[Math.max(0, chain.length - TRUSTED_PROXY_HOPS)];
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Returns a 429 response if this visitor is over the limit, otherwise records the hit
 * and returns null.
 */
export function checkRateLimit(req: NextRequest, limit: Limit): NextResponse | null {
  const key = `${limit.name}:${clientId(req)}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < limit.windowMs);

  if (recent.length >= limit.max) {
    const retryAfter = Math.ceil((recent[0] + limit.windowMs - now) / 1000);
    hits.set(key, recent);
    return NextResponse.json(
      {
        error: `You've hit the limit of ${limit.max} ${
          limit.name === "ingest" ? "new videos" : "questions"
        } per ${Math.round(limit.windowMs / 60_000)} minutes. Try again in ${formatWait(retryAfter)}.`,
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  recent.push(now);
  hits.set(key, recent);
  pruneOccasionally(now);
  return null;
}

function formatWait(seconds: number): string {
  return seconds < 90 ? `${seconds} seconds` : `${Math.ceil(seconds / 60)} minutes`;
}

// Drop visitors with no recent hits so the map doesn't grow forever
let lastPrune = 0;
function pruneOccasionally(now: number) {
  if (now - lastPrune < 10 * 60_000) return;
  lastPrune = now;
  const longest = Math.max(...Object.values(LIMITS).map((l) => l.windowMs));
  for (const [key, times] of hits) {
    if (times.every((t) => now - t > longest)) hits.delete(key);
  }
}
