"use client";

import React from "react";
import { Radio, Cpu, Sparkles } from "lucide-react";
import { PodcastEpisode } from "@/types/podcast";

interface StudioHeaderProps {
  episodes: PodcastEpisode[];
  currentEpisode: PodcastEpisode;
  onSelectEpisode: (episode: PodcastEpisode) => void;
  llmModel: string;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  episodes,
  currentEpisode,
  onSelectEpisode,
  llmModel,
}) => {
  return (
    <header className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)]/80 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#4f46e5] text-white font-black text-sm shadow-[0_2px_10px_rgba(99,102,241,0.35)]">
            S
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-[var(--color-ink)] flex items-center gap-1.5 font-sans">
                Scrubcast
                <span className="text-[var(--color-ink-faint)] font-normal text-sm">/</span>
                <span className="text-xs font-mono font-medium text-[var(--color-ink-muted)]">
                  Intelligence Workbench
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--color-accent-faint)] text-[var(--color-accent-hover)] border border-[var(--color-accent)]/25 tracking-wide">
                  v2.0
                </span>
              </h1>
            </div>
            <p className="text-xs text-[var(--color-ink-muted)] hidden sm:block">
              Ask a question about a podcast and jump to the moment it was said
            </p>
          </div>
        </div>

        {/* Engine status & Episode Selector */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
          {/* Local Embedder status badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0d0f15] border border-[var(--color-border-deck)] text-[var(--color-ink-muted)]">
            <Cpu className="w-3.5 h-3.5 text-[var(--color-secondary)]" />
            <span>EMBED:</span>
            <span className="text-[var(--color-ink)] font-medium">bge-small-en</span>
          </div>

          {/* Groq Cloud status badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0d0f15] border border-[var(--color-border-deck)] text-[var(--color-ink-muted)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent-hover)]" />
            <span>LLM:</span>
            <span className="text-[var(--color-ink)] font-medium">{llmModel.split("/").pop()}</span>
          </div>

          {/* Episode Selector dropdown */}
          <div className="flex items-center gap-1.5 ml-auto sm:ml-0 bg-[#0d0f15] border border-[var(--color-border-deck)] rounded-lg p-1">
            <Radio className="w-3.5 h-3.5 text-[var(--color-accent-hover)] ml-1.5" />
            <select
              value={currentEpisode.id}
              onChange={(e) => {
                const ep = episodes.find((item) => item.id === e.target.value);
                if (ep) onSelectEpisode(ep);
              }}
              className="max-w-[260px] truncate bg-transparent text-[var(--color-ink)] text-xs font-sans rounded px-2 py-1 outline-none cursor-pointer focus:ring-1 focus:ring-[var(--color-accent)]"
            >
              {episodes.map((ep) => (
                <option
                  key={ep.id}
                  value={ep.id}
                  className="bg-[#141722] text-[var(--color-ink)] py-1"
                >
                  {ep.showTitle === ep.guest ? ep.title : `${ep.showTitle} — ${ep.guest}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
