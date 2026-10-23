"use client";

import React, { useRef, useEffect } from "react";
import { Search, Loader2, ArrowRight, Zap, Clock } from "lucide-react";
import { PodcastEpisode } from "@/types/podcast";

interface SearchBarProps {
  currentEpisode: PodcastEpisode;
  query: string;
  setQuery: (q: string) => void;
  onSearch: (q?: string) => void;
  isLoading: boolean;
  latencyMs?: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  currentEpisode,
  query,
  setQuery,
  onSearch,
  isLoading,
  latencyMs,
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

  return (
    <div className="w-full space-y-3">
      {/* Search Input Box */}
      <form onSubmit={handleSubmit} className="relative group">
        <div className="relative flex items-center bg-[var(--color-surface)] border border-[var(--color-border-deck)] rounded-xl shadow-lg transition-all duration-200 focus-within:border-[var(--color-accent)] focus-within:ring-2 focus-within:ring-[var(--color-accent)]/20">
          <div className="pl-4 pr-2 text-[var(--color-ink-muted)] group-focus-within:text-[var(--color-accent-hover)] transition-colors">
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[var(--color-accent)]" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Ask anything about ${currentEpisode.guest}'s interview...`}
            className="w-full py-3.5 pr-28 text-sm md:text-base bg-transparent text-[var(--color-ink)] placeholder-[var(--color-ink-faint)] outline-none font-sans"
          />

          {/* Right actions: Shortcut badge & Submit Button */}
          <div className="absolute right-2.5 flex items-center gap-2">
            {!isLoading && (
              <span className="hidden sm:inline-block text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-[#10131d] border border-[var(--color-border-deck)] text-[var(--color-ink-faint)]">
                ⌘K
              </span>
            )}

            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:hover:bg-[var(--color-accent)] text-white font-semibold text-xs transition-all shadow-sm active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Search</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </form>

      {/* Suggested Quick Prompts & Latency Readout */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="min-w-0 flex items-center gap-1.5 flex-wrap pb-1 text-[var(--color-ink-muted)]">
          <span className="flex items-center gap-1 text-[var(--color-accent-hover)] font-mono text-[11px] font-medium shrink-0">
            <Zap className="w-3 h-3" /> Quick Query:
          </span>
          {suggestions.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                setQuery(item);
                onSearch(item);
              }}
              className="max-w-full [overflow-wrap:anywhere] text-left px-2.5 py-1 rounded-md bg-[var(--color-surface)] border border-[var(--color-border-deck)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-hover)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors text-xs cursor-pointer active:scale-95"
            >
              {item}
            </button>
          ))}
        </div>

        {latencyMs !== undefined && (
          <div className="flex items-center gap-1 text-[11px] font-mono text-[var(--color-secondary)] shrink-0 self-end sm:self-auto bg-[#0d0f15] px-2.5 py-1 rounded-md border border-[var(--color-border-deck)]">
            <Clock className="w-3 h-3" />
            <span>Search & synth:</span>
            <span className="font-bold">{latencyMs}ms</span>
          </div>
        )}
      </div>
    </div>
  );
};
