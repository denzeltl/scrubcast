"use client";

import React, { useRef, useEffect, useState } from "react";
import { cleanCaption } from "@/lib/captions";
import { PodcastEpisode } from "@/types/podcast";
import { formatTimestamp } from "@/lib/time";
import { FileText, Play, ArrowDownCircle } from "lucide-react";

interface TranscriptFeedProps {
  episode: PodcastEpisode;
  activeSecond: number;
  onSeek: (seconds: number) => void;
  highlightedChunkId?: string;
}

export const TranscriptFeed: React.FC<TranscriptFeedProps> = ({
  episode,
  activeSecond,
  onSeek,
  highlightedChunkId,
}) => {
  const [filterSpeaker, setFilterSpeaker] = useState<string>("all");
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const activeChunkRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine active chunk based on current playback second
  const activeChunk = episode.chunks.find(
    (c) => activeSecond >= c.startTime && activeSecond <= c.endTime
  );

  // Auto-scroll to active chunk if enabled. Scrolls only the transcript list:
  // scrollIntoView would also drag the whole page to the transcript during playback.
  useEffect(() => {
    const container = containerRef.current;
    const row = activeChunkRef.current;
    if (!autoScroll || !container || !row) return;

    const rowTop = row.offsetTop - container.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    if (rowTop < viewTop) {
      container.scrollTo({ top: rowTop, behavior: "smooth" });
    } else if (rowBottom > viewBottom) {
      container.scrollTo({ top: rowBottom - container.clientHeight, behavior: "smooth" });
    }
  }, [activeChunk?.id, autoScroll]);

  // Unique speakers in this episode
  const speakers = Array.from(new Set(episode.chunks.map((c) => c.speaker)));

  const filteredChunks =
    filterSpeaker === "all"
      ? episode.chunks
      : episode.chunks.filter((c) => c.speaker === filterSpeaker);

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border-deck)] rounded-2xl p-4 shadow-lg flex flex-col h-[520px]">
      {/* Transcript Header & Filter */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] pb-3 mb-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-[var(--color-accent-hover)]" />
          <h3 className="min-w-0 [overflow-wrap:anywhere] text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
            Transcript
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto scroll toggle button */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
              autoScroll
                ? "bg-[var(--color-accent-faint)] text-[var(--color-accent-hover)] border-[var(--color-accent)]/30"
                : "bg-transparent text-[var(--color-ink-faint)] border-[var(--color-border-deck)]"
            }`}
            title="Toggle auto-follow playback position"
          >
            <ArrowDownCircle className="w-3 h-3" />
            <span>Follow playback</span>
          </button>

          {/* Speaker filter selector */}
          {/* Only worth a filter when the transcript names more than one speaker */}
          {speakers.length > 1 && (
          <select
            value={filterSpeaker}
            onChange={(e) => setFilterSpeaker(e.target.value)}
            className="max-w-[180px] text-[11px] font-sans bg-[var(--color-chassis)] border border-[var(--color-border-deck)] text-[var(--color-ink)] rounded px-2 py-0.5 outline-none cursor-pointer"
          >
            <option value="all">All speakers</option>
            {speakers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          )}
        </div>
      </div>

      {/* Scrollable Transcript List */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-2 pr-1.5 scroll-smooth"
      >
        {filteredChunks.map((chunk) => {
          const isPlaying = activeChunk?.id === chunk.id;
          const isHighlighted = highlightedChunkId === chunk.id;
          const timecode = formatTimestamp(chunk.startTime);

          return (
            <div
              key={chunk.id}
              ref={isPlaying ? activeChunkRef : null}
              onClick={() => onSeek(chunk.startTime)}
              className={`p-3 rounded-xl border transition-all cursor-pointer group ${
                isPlaying
                  ? "bg-[var(--color-surface-active)] border-[var(--color-accent)] shadow-md"
                  : isHighlighted
                  ? "bg-[var(--color-well)] border-[var(--color-secondary)]/50"
                  : "bg-[var(--color-well)] border-[var(--color-border-deck)] hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 transition-colors ${
                      isPlaying
                        ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                        : "bg-[var(--color-surface-hover)] text-[var(--color-accent-hover)] group-hover:bg-[var(--color-accent)] group-hover:text-[var(--color-accent-ink)]"
                    }`}
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                    [{timecode}]
                  </span>

                  {chunk.speaker !== "Speaker" && (
                  <span
                    className={`font-semibold text-xs ${
                      chunk.speaker === episode.guest
                        ? "text-[var(--color-secondary)]"
                        : "text-[var(--color-ink-muted)]"
                    }`}
                  >
                    {chunk.speaker}
                  </span>
                  )}
                </div>

                {isPlaying && (
                  <span className="flex items-center gap-1 text-[10px] text-[var(--color-accent-hover)] font-bold animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                    Now playing
                  </span>
                )}
              </div>

              <p
                className={`text-xs leading-relaxed transition-colors ${
                  isPlaying
                    ? "text-[var(--color-ink)] font-medium"
                    : "text-[var(--color-ink-muted)] group-hover:text-[var(--color-ink)]"
                }`}
              >
                {cleanCaption(chunk.text)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
