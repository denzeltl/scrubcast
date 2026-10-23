"use client";

import { useEffect, useState } from "react";
import { SummaryStatus } from "@/types/podcast";

const POLL_MS = 4000;

/**
 * Whole-video summary for an episode. Starts generation if it hasn't run yet and
 * polls while the background job works through the transcript.
 */
export function useEpisodeSummary(episodeId: string): SummaryStatus | null {
  const [status, setStatus] = useState<{ episodeId: string; value: SummaryStatus } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Ask the server to (re)start a job at most once per time the video is opened
    let requested = false;

    const request = (method: "GET" | "POST") =>
      fetch(
        method === "GET" ? `/api/summary?episodeId=${encodeURIComponent(episodeId)}` : "/api/summary",
        method === "POST"
          ? { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ episodeId }) }
          : undefined
      ).then((res) => (res.ok ? (res.json() as Promise<SummaryStatus>) : null));

    const tick = async (method: "GET" | "POST") => {
      const value = await request(method).catch(() => null);
      if (cancelled || !value) return;
      // Not generated yet (or the server restarted mid-job, or it failed): ask for it once
      if ((value.state === "none" || value.state === "error") && !requested) {
        requested = true;
        return tick("POST");
      }
      setStatus({ episodeId, value });
      if (value.state === "running") timer = setTimeout(() => tick("GET"), POLL_MS);
    };

    void tick("GET");
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [episodeId]);

  // Never show the previous episode's summary while the new one loads
  return status?.episodeId === episodeId ? status.value : null;
}
