"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { PodcastEpisode, SearchResult } from "@/types/podcast";
import { StudioHeader } from "@/components/StudioHeader";
import { SearchBar } from "@/components/SearchBar";
import { PlayerDeck, PlayerDeckHandle } from "@/components/PlayerDeck";
import { SynthesizedAnswer } from "@/components/SynthesizedAnswer";
import { SemanticMatches } from "@/components/SemanticMatches";
import { TranscriptFeed } from "@/components/TranscriptFeed";
import { SourceRow } from "@/components/SourceRow";
import { useEpisodeSummary } from "@/components/useEpisodeSummary";
import { SummaryCard } from "@/components/SummaryCard";
import { AlertCircle } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { prewarmServer } from "@/lib/prewarm";
import { ColdStartIndicator, ColdStartBanner } from "@/components/ColdStartIndicator";

interface WorkbenchProps {
  episodes: PodcastEpisode[];
  // Groq model id, shown in the header and footer
  llmModel: string;
}

// Carries the API's error code so the source row can tell a YouTube block from a bad link
class IngestFailure extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

async function fetchIngest(url: string): Promise<PodcastEpisode> {
  const res = await fetch("/api/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new IngestFailure(data?.error || `Couldn't add that video (${res.status})`, data?.code);
  }
  return data.episode as PodcastEpisode;
}

async function fetchSearch(query: string, episodeId: string, reindexed = false): Promise<SearchResult> {
  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, episodeId }),
  });
  const data = await res.json().catch(() => null);

  // Pasted videos live only in server memory and can be dropped (restart, or newer
  // videos pushed them out). Re-index from the YouTube id and ask again, once.
  if (res.status === 404 && episodeId.startsWith("yt-") && !reindexed) {
    await fetchIngest(`https://youtu.be/${episodeId.slice(3)}`);
    return fetchSearch(query, episodeId, true);
  }

  if (!res.ok) {
    throw new Error(data?.error || `Search failed (${res.status})`);
  }
  return data as SearchResult;
}

// Each visitor's pasted videos are listed only for them, and kept in their own browser
// so the list survives a reload. The server never lists them; if it has forgotten one,
// fetchSearch re-indexes it on the next question.
const PASTED_KEY = "scrubcast:pasted-videos";
const MAX_REMEMBERED = 10;

function loadPasted(): PodcastEpisode[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PASTED_KEY) ?? "[]");
    // Browser storage can hold anything (old versions, manual edits): keep only well-formed videos
    return Array.isArray(saved) ? saved.filter(isStoredEpisode) : [];
  } catch {
    return [];
  }
}

function isStoredEpisode(value: unknown): value is PodcastEpisode {
  const ep = value as Partial<PodcastEpisode> | null;
  return (
    !!ep &&
    typeof ep.id === "string" &&
    /^yt-[A-Za-z0-9_-]{11}$/.test(ep.id) &&
    typeof ep.title === "string" &&
    typeof ep.youtubeId === "string" &&
    typeof ep.duration === "number" &&
    Array.isArray(ep.chunks) &&
    ep.chunks.length > 0 &&
    ep.chunks.every(
      (c) => typeof c?.text === "string" && typeof c.startTime === "number" && typeof c.endTime === "number"
    )
  );
}

function rememberPasted(episode: PodcastEpisode) {
  try {
    const others = loadPasted().filter((ep) => ep.id !== episode.id);
    // Newest last, matching the picker order; oldest dropped past the cap
    const next = [...others, episode].slice(-MAX_REMEMBERED);
    localStorage.setItem(PASTED_KEY, JSON.stringify(next));
  } catch {
    // Private mode or storage full: the list just won't survive a reload
  }
}

function defaultQueryFor(episode: PodcastEpisode): string {
  return episode.suggestedQueries?.[0] ?? `What is ${episode.guest} talking about?`;
}

export const Workbench: React.FC<WorkbenchProps> = ({ episodes: initialEpisodes, llmModel }) => {
  // Grows as the user indexes YouTube links
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>(initialEpisodes);
  const [isIngesting, setIsIngesting] = useState<boolean>(false);
  const [ingestElapsedSec, setIngestElapsedSec] = useState<number>(0);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [youtubeBlocked, setYoutubeBlocked] = useState(false);
  const [currentEpisode, setCurrentEpisode] = useState<PodcastEpisode>(episodes[0]);
  const [query, setQuery] = useState<string>(() => defaultQueryFor(episodes[0]));
  // Starts true because the first search fires on mount
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchElapsedSec, setSearchElapsedSec] = useState<number>(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [activeSecond, setActiveSecond] = useState<number>(0);
  const [highlightedChunkId, setHighlightedChunkId] = useState<string | undefined>(undefined);
  const summaryStatus = useEpisodeSummary(currentEpisode.id);

  const playerRef = useRef<PlayerDeckHandle>(null);
  const playerDeckRef = useRef<HTMLDivElement>(null);
  // Only the most recent request may write results, so a slow answer for a
  // previous episode or query can't overwrite a newer one
  const latestRequestRef = useRef(0);

  // Pre-warm backend on page mount, tab visibility resume, or window focus
  useEffect(() => {
    prewarmServer();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        prewarmServer();
      }
    };
    const handleFocus = () => {
      prewarmServer();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Track search elapsed time for cold start detection
  useEffect(() => {
    if (!isLoading) {
      setSearchElapsedSec(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setSearchElapsedSec((Date.now() - start) / 1000);
    }, 200);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Track ingest elapsed time for cold start detection
  useEffect(() => {
    if (!isIngesting) {
      setIngestElapsedSec(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setIngestElapsedSec((Date.now() - start) / 1000);
    }, 200);
    return () => clearInterval(interval);
  }, [isIngesting]);

  // Perform search against local vector index & Groq.
  // State is only set from promise callbacks so this is safe to call from an effect.
  const runSearch = useCallback((q: string, episodeId: string) => {
    const requestId = ++latestRequestRef.current;
    const isLatest = () => requestId === latestRequestRef.current;

    return fetchSearch(q, episodeId)
      .then(
        (result) => {
          if (!isLatest()) return;
          setSearchResult(result);
          setSearchError(null);
          // Auto highlight top match chunk
          setHighlightedChunkId(result.topChunks[0]?.chunk.id);
        },
        (err: unknown) => {
          if (!isLatest()) return;
          console.error("Search error:", err);
          setSearchError(err instanceof Error ? err.message : "Search failed");
        }
      )
      .finally(() => {
        if (isLatest()) setIsLoading(false);
      });
  }, []);

  const startSearch = (q: string, episodeId: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setIsLoading(true);
    void runSearch(trimmed, episodeId);
  };

  // Bring back this visitor's own pasted videos from their browser after hydration.
  // Set from a promise callback: the server render only knows the featured videos.
  useEffect(() => {
    void Promise.resolve(loadPasted()).then((saved) => {
      if (saved.length === 0) return;
      setEpisodes((list) => [...list, ...saved.filter((ep) => !list.some((e) => e.id === ep.id))]);
    });
  }, []);

  // Run initial search on mount to populate the workspace with live data
  const initialEpisodeId = episodes[0].id;
  const initialQuery = defaultQueryFor(episodes[0]);
  useEffect(() => {
    void runSearch(initialQuery, initialEpisodeId);
  }, [runSearch, initialQuery, initialEpisodeId]);

  // Seek video to exact second
  const handleSeek = (seconds: number) => {
    setActiveSecond(seconds);
    playerRef.current?.seekTo(seconds);
    // Stacked layout: the player may be scrolled away from the chip that was clicked.
    // Bring it back so the seek is visible.
    const deck = playerDeckRef.current;
    if (deck && window.matchMedia("(max-width: 1023px)").matches) {
      const top = deck.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        deck.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      }
    }
  };

  // When episode changes, clear the old episode's results & re-run with its default query
  const handleSelectEpisode = (ep: PodcastEpisode) => {
    setCurrentEpisode(ep);
    setSearchResult(null);
    setSearchError(null);
    setHighlightedChunkId(undefined);
    setActiveSecond(0);
    const newQuery = defaultQueryFor(ep);
    setQuery(newQuery);
    startSearch(newQuery, ep.id);
  };

  // Index a YouTube link, add it to the episode list and switch to it.
  // Resolves true on success so the form can clear its input.
  const handleIngest = async (url: string): Promise<boolean> => {
    setIsIngesting(true);
    setIngestError(null);
    setYoutubeBlocked(false);
    try {
      const ep = await fetchIngest(url);
      setEpisodes((list) => (list.some((e) => e.id === ep.id) ? list : [...list, ep]));
      if (!initialEpisodes.some((e) => e.id === ep.id)) rememberPasted(ep);
      handleSelectEpisode(ep);
      return true;
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : "Couldn't add that video");
      setYoutubeBlocked(err instanceof IngestFailure && err.code === "youtube_blocked");
      return false;
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-chassis)] text-[var(--color-ink)] flex flex-col font-sans selection:bg-[var(--color-accent)] selection:text-[var(--color-accent-ink)]">
      {/* Top Navigation & Workspace Header */}
      <StudioHeader
        episodes={episodes}
        currentEpisode={currentEpisode}
        onSelectEpisode={handleSelectEpisode}
      />

      {/* Main Intelligence Workspace */}
      <main className="flex-1 max-w-[1520px] w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Step one: which video is being searched, or index a new one */}
        <SourceRow
          currentEpisode={currentEpisode}
          onIngest={handleIngest}
          isIngesting={isIngesting}
          error={ingestError}
          youtubeBlocked={youtubeBlocked}
          ingestElapsedSec={ingestElapsedSec}
        />

        {/* Command Search Bar */}
        <section className="w-full">
          <SearchBar
            currentEpisode={currentEpisode}
            query={query}
            setQuery={setQuery}
            onSearch={(q) => startSearch(q ?? query, currentEpisode.id)}
            isLoading={isLoading}
            latencyMs={searchResult?.latencyMs?.total}
            elapsedSec={searchElapsedSec}
          />
        </section>

        {/* 50/50 Dual Stage Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left column: the answer first (right under the question), then its evidence.
              Below lg both columns dissolve (display: contents) so each card can be ordered:
              player, answer, about, passages, transcript. */}
          <div className="contents lg:block lg:col-span-6 lg:space-y-6">
            <div className="order-2 lg:order-none space-y-6">
            {searchError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--color-deck-danger)]/10 border border-[var(--color-deck-danger)]/40 text-xs text-[var(--color-ink)]"
              >
                <AlertCircle className="w-4 h-4 text-[var(--color-deck-danger)] shrink-0 mt-0.5" />
                <span>{searchError}</span>
              </div>
            )}

            {/* The answer, with [MM:SS] chips that seek the player */}
            {searchResult ? (
              <div className="relative space-y-4">
                {isLoading && searchElapsedSec >= 2.5 && (
                  <ColdStartBanner elapsedSec={searchElapsedSec} />
                )}
                <div className={isLoading ? "opacity-60 transition-opacity pointer-events-none" : ""}>
                  <SynthesizedAnswer
                    searchResult={searchResult}
                    onSeek={handleSeek}
                    activeSecond={activeSecond}
                  />
                </div>
              </div>
            ) : (
              <ColdStartIndicator
                isLoading={isLoading}
                elapsedSec={searchElapsedSec}
              />
            )}
            </div>

            {/* The passages the answer drew on */}
            {searchResult && (
              <div className="order-4 lg:order-none">
              <SemanticMatches
                matches={searchResult.topChunks}
                onSeek={handleSeek}
                activeSecond={activeSecond}
              />
              </div>
            )}
          </div>

          {/* Right column: player, what the video covers, transcript. Pinned on desktop; when
              it's taller than the screen it scrolls on its own so nothing becomes unreachable. */}
          <div className="contents lg:block lg:col-span-6 lg:space-y-6 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
            <div ref={playerDeckRef} className="order-1 lg:order-none scroll-mt-20">
            {/* YouTube Interactive Video Deck; keyed so player state resets per episode */}
            <PlayerDeck
              key={`player-${currentEpisode.id}`}
              ref={playerRef}
              episode={currentEpisode}
              matches={searchResult?.topChunks || []}
              onTimeUpdate={setActiveSecond}
            />
            </div>

            {/* What the whole video covers: overview, main argument, chapters (they seek the player above) */}
            <div className="order-3 lg:order-none">
            <SummaryCard
              key={`summary-${currentEpisode.id}`}
              status={summaryStatus}
              onSeek={handleSeek}
              activeSecond={activeSecond}
            />
            </div>

            {/* Synchronized Transcript Feed; keyed so the speaker filter resets per episode */}
            <div className="order-5 lg:order-none">
            <TranscriptFeed
              key={`transcript-${currentEpisode.id}`}
              episode={currentEpisode}
              activeSecond={activeSecond}
              onSeek={handleSeek}
              highlightedChunkId={highlightedChunkId}
            />
            </div>
          </div>
        </div>
      </main>

      {/* Footer: what powers it */}
      <footer className="border-t border-[var(--color-border-subtle)] bg-[var(--color-chassis)] px-4 lg:px-8 py-3.5 mt-12 text-xs font-mono text-[var(--color-ink-faint)]">
        <div className="max-w-[1520px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BrandMark size={18} />
            <span>Scrubcast answers from the video&apos;s own captions.</span>
          </div>
          <p className="hidden md:block text-right">
            Answers by {llmModel.split("/").pop()} on Groq
          </p>
        </div>
      </footer>
    </div>
  );
};
