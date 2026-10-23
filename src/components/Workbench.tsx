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
import { AlertCircle, Sparkles, Terminal } from "lucide-react";

interface WorkbenchProps {
  episodes: PodcastEpisode[];
}

async function fetchIngest(url: string): Promise<PodcastEpisode> {
  const res = await fetch("/api/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `Couldn't add that video (${res.status})`);
  }
  return data.episode as PodcastEpisode;
}

async function fetchSearch(query: string, episodeId: string): Promise<SearchResult> {
  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, episodeId }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `Search failed (${res.status})`);
  }
  return data as SearchResult;
}

function defaultQueryFor(episode: PodcastEpisode): string {
  return episode.suggestedQueries?.[0] ?? `What is ${episode.guest} talking about?`;
}

export const Workbench: React.FC<WorkbenchProps> = ({ episodes: initialEpisodes }) => {
  // Grows as the user indexes YouTube links
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>(initialEpisodes);
  const [isIngesting, setIsIngesting] = useState<boolean>(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<PodcastEpisode>(episodes[0]);
  const [query, setQuery] = useState<string>(() => defaultQueryFor(episodes[0]));
  // Starts true because the first search fires on mount
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [activeSecond, setActiveSecond] = useState<number>(0);
  const [highlightedChunkId, setHighlightedChunkId] = useState<string | undefined>(undefined);

  const playerRef = useRef<PlayerDeckHandle>(null);
  // Only the most recent request may write results, so a slow answer for a
  // previous episode or query can't overwrite a newer one
  const latestRequestRef = useRef(0);

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
    try {
      const ep = await fetchIngest(url);
      setEpisodes((list) => (list.some((e) => e.id === ep.id) ? list : [...list, ep]));
      handleSelectEpisode(ep);
      return true;
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : "Couldn't add that video");
      return false;
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-chassis)] text-[var(--color-ink)] flex flex-col font-sans selection:bg-[var(--color-accent)] selection:text-white">
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
          />
        </section>

        {/* 50/50 Dual Stage Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (Intelligence Flow: Synthesis & Evidence): 6 cols */}
          <div className="lg:col-span-6 space-y-6">
            {searchError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--color-deck-danger)]/10 border border-[var(--color-deck-danger)]/40 text-xs text-[var(--color-ink)]"
              >
                <AlertCircle className="w-4 h-4 text-[var(--color-deck-danger)] shrink-0 mt-0.5" />
                <span>{searchError}</span>
              </div>
            )}

            {/* Sub-second Grounded AI Synthesis with [MM:SS] Citation Chips */}
            {searchResult ? (
              <SynthesizedAnswer
                searchResult={searchResult}
                onSeek={handleSeek}
                activeSecond={activeSecond}
              />
            ) : (
              <div className="bg-[var(--color-surface)] border border-[var(--color-border-deck)] rounded-2xl p-8 text-center text-sm text-[var(--color-ink-muted)] space-y-3 shadow-lg">
                <Sparkles className="w-6 h-6 mx-auto text-[var(--color-accent-hover)]" />
                <p>
                  {isLoading
                    ? "Searching the transcript…"
                    : "Ask a question above. The answer cites timestamps you can click to jump the video to that moment."}
                </p>
              </div>
            )}

            {/* Top Cosine Similarity Vector Matches */}
            {searchResult && (
              <SemanticMatches
                matches={searchResult.topChunks}
                onSeek={handleSeek}
                activeSecond={activeSecond}
              />
            )}
          </div>

          {/* Right Column (Playback Viewport & Transcript Rail): 6 cols, sticky on desktop */}
          <div className="lg:col-span-6 space-y-6 lg:sticky lg:top-20">
            {/* YouTube Interactive Video Deck; keyed so player state resets per episode */}
            <PlayerDeck
              key={`player-${currentEpisode.id}`}
              ref={playerRef}
              episode={currentEpisode}
              matches={searchResult?.topChunks || []}
              onTimeUpdate={setActiveSecond}
            />

            {/* Synchronized Transcript Feed; keyed so the speaker filter resets per episode */}
            <TranscriptFeed
              key={`transcript-${currentEpisode.id}`}
              episode={currentEpisode}
              activeSecond={activeSecond}
              onSeek={handleSeek}
              highlightedChunkId={highlightedChunkId}
            />
          </div>
        </div>
      </main>

      {/* Modern Console Footer */}
      <footer className="border-t border-[var(--color-border-subtle)] bg-[#090b10] px-4 lg:px-8 py-3.5 mt-12 text-xs font-mono text-[var(--color-ink-faint)]">
        <div className="max-w-[1520px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-[var(--color-accent-hover)]" />
            <span>SCRUBCAST INTELLIGENCE WORKBENCH • LOCAL VECTOR RAG</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Model: Xenova/bge-small-en-v1.5 (384-d)</span>
            <span>•</span>
            <span>LLM: Groq Llama 3.3 70B</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
