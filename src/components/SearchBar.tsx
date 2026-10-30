"use client";

import React, { useRef, useEffect } from "react";
import { Search, Loader2, ArrowRight, Clock, Server, BookOpen, Globe, RotateCcw } from "lucide-react";
import { PodcastEpisode } from "@/types/podcast";
import { prewarmServer } from "@/lib/prewarm";

interface SearchBarProps {
  currentEpisode: PodcastEpisode;
  query: string;
  setQuery: (q: string) => void;
  onSearch: (q?: string) => void;
  isLoading: boolean;
  latencyMs?: number;
  elapsedSec?: number;
  knowledgeMode: "video_only" | "hybrid";
  onToggleKnowledgeMode: (mode: "video_only" | "hybrid") => void;
  historyCount: number;
  onClearHistory: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  currentEpisode,
  query,
  setQuery,
  onSearch,
  isLoading,
  latencyMs,
  elapsedSec = 0,
  knowledgeMode,
  onToggleKnowledgeMode,
  historyCount,
  onClearHistory,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Suggested prompts per episode
  const suggestions = currentEpisode.suggestedQueries ?? [];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onSearch();
    }
  };

  const isColdStarting = isLoading && elapsedSec >= 2.5;

  return (
    <div className="w-full space-y-3">
      {/* Search Input Box */}
      <form onSubmit={handleSubmit} className="relative group">
        <div className="relative flex items-center bg-[var(--color-surface)] border border-[var(--color-border-deck)] rounded-xl shadow-lg transition-all duration-200 focus-within:border-[var(--color-accent)] focus-within:ring-2 focus-within:ring-[var(--color-accent)]/20">
          <div className="pl-4 pr-2 text-[var(--color-ink-muted)] group-focus-within:text-[var(--color-accent-hover)] transition-colors">
            {isColdStarting ? (
              <Server className="w-5 h-5 text-[var(--color-accent)] animate-pulse" />
            ) : isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[var(--color-accent)]" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onFocus={() => prewarmServer()}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything about this video…"
            className="w-full py-3.5 pr-14 sm:pr-24 text-sm md:text-base bg-transparent text-[var(--color-ink)] placeholder-[var(--color-ink-faint)] outline-none font-sans"
          />

          {/* Right actions: Shortcut badge & Submit Button */}
          <div className="absolute right-2.5 flex items-center gap-2">

            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              aria-label="Ask"
              className="flex items-center gap-1.5 h-9 px-3 sm:px-3.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-accent-ink)] font-display font-extrabold text-sm cursor-pointer transition-[transform,background-color] duration-[140ms] ease-[cubic-bezier(0.16,1,0.3,1)] [@media(hover:hover)]:hover:bg-[var(--color-accent-hover)] [@media(hover:hover)]:hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] disabled:bg-[var(--color-surface-active)] disabled:text-[var(--color-ink-faint)] disabled:border disabled:border-[var(--color-border-deck)] disabled:translate-y-0 disabled:cursor-not-allowed"
            >
              {isColdStarting ? (
                <>
                  <span className="hidden sm:inline font-mono text-xs">
                    Waking ({Math.floor(elapsedSec)}s)
                  </span>
                  <span className="sm:hidden font-mono text-xs">{Math.floor(elapsedSec)}s</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Ask</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Mode toggles, thread controls & Suggested Quick Prompts */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2">
          {/* Knowledge Mode Toggle */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-deck)] text-[11px] font-mono">
            <button
              type="button"
              onClick={() => onToggleKnowledgeMode("video_only")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                knowledgeMode === "video_only"
                  ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] font-semibold shadow-xs"
                  : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              }`}
              title="Answers strictly using timestamps from the video"
            >
              <BookOpen className="w-3 h-3" />
              <span>Video only</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleKnowledgeMode("hybrid")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                knowledgeMode === "hybrid"
                  ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] font-semibold shadow-xs"
                  : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              }`}
              title="Combines video captions with general knowledge when needed"
            >
              <Globe className="w-3 h-3" />
              <span>Hybrid (+ Outside knowledge)</span>
            </button>
          </div>

          {/* Follow-up thread indicator & reset */}
          {historyCount > 0 && (
            <div className="flex items-center gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border-deck)] px-2.5 py-1 rounded-lg text-[11px] font-mono text-[var(--color-ink-muted)]">
              <span>{historyCount} turn{historyCount > 1 ? "s" : ""} in memory</span>
              <button
                type="button"
                onClick={onClearHistory}
                className="text-[var(--color-accent-hover)] hover:underline flex items-center gap-0.5 cursor-pointer ml-1"
                title="Reset conversation memory"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset</span>
              </button>
            </div>
          )}
        </div>

        {latencyMs !== undefined && (
          <div className="flex items-center gap-1 text-[11px] font-mono text-[var(--color-secondary)] shrink-0 self-end sm:self-auto bg-[var(--color-chassis)] px-2.5 py-1 rounded-md border border-[var(--color-border-deck)]">
            <Clock className="w-3 h-3" />
            <span>Answered in</span>
            <span className="font-bold">{(latencyMs / 1000).toFixed(1)} s</span>
          </div>
        )}
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="min-w-0 flex items-center gap-1.5 flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_85%,transparent)] sm:[mask-image:none] text-[var(--color-ink-muted)]">
          <span className="flex items-center gap-1 text-[var(--color-accent-hover)] font-mono text-[11px] font-medium shrink-0">
            Try:
          </span>
          {suggestions.map((item, index) => (
            <button
              key={index}
              onMouseEnter={() => prewarmServer()}
              onClick={() => {
                setQuery(item);
                onSearch(item);
              }}
              className="shrink-0 whitespace-nowrap sm:whitespace-normal sm:shrink sm:max-w-full sm:[overflow-wrap:anywhere] text-left px-2.5 py-1.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border-deck)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-hover)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors text-xs cursor-pointer active:scale-95"
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
