/**
 * Frontend pre-warming utility for Render free-tier cold starts.
 *
 * Free-tier instances sleep after 15 minutes of inactivity. Pinging /api/health
 * when the visitor arrives, refocuses the tab, or focuses interactive elements
 * wakes up the container early.
 */

let lastPrewarmedAt = 0;
// Minimum delay between keep-alive pings (1 minute)
const PREWARM_THROTTLE_MS = 60 * 1000;

export function prewarmServer(): void {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastPrewarmedAt < PREWARM_THROTTLE_MS) {
    return;
  }
  lastPrewarmedAt = now;

  try {
    // keepalive: true ensures the ping completes even if navigation happens
    fetch("/api/health", {
      method: "GET",
      cache: "no-store",
      keepalive: true,
    }).catch(() => {
      // Best-effort speculative ping; ignore network failures
    });
  } catch {
    // Ignore environments where fetch is unavailable or blocked
  }
}
