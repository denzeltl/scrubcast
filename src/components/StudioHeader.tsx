"use client";

import React from "react";
import { BrandMark } from "@/components/BrandMark";
import { PodcastEpisode } from "@/types/podcast";

interface StudioHeaderProps {
  episodes: PodcastEpisode[];
  currentEpisode: PodcastEpisode;
  onSelectEpisode: (episode: PodcastEpisode) => void;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  episodes,
  currentEpisode,
  onSelectEpisode,
}) => {
  return (
    <header className="border-b border-[var(--color-border-subtle)] bg-[var(--color-chassis)]/85 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Brand identity */}
        <div className="flex items-center gap-3 min-w-0">
          <BrandMark size={36} className="shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display text-xl font-extrabold tracking-[-0.04em] leading-none text-[var(--color-ink)] [overflow-wrap:anywhere]">
              Scrubcast
            </h1>
            <p className="text-xs text-[var(--color-ink-muted)] mt-1 hidden lg:block">
              Ask a video anything, then jump to the moment it&apos;s said
            </p>
          </div>
        </div>

        {/* Video picker */}
        <div className="flex items-center gap-2.5 text-xs font-mono">
          <label
            htmlFor="video-picker"
            className="hidden sm:block uppercase tracking-[0.12em] text-[11px] text-[var(--color-ink-faint)]"
          >
            Video
          </label>
          <div className="flex items-center gap-1.5 w-full md:w-auto bg-[var(--color-chassis)] border border-[var(--color-border-deck)] rounded-lg p-1 transition-colors duration-[140ms] [@media(hover:hover)]:hover:border-[var(--color-ink-faint)] focus-within:border-[var(--color-accent)]">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-playhead)] ml-2 shrink-0" aria-hidden="true" />
            <select
              id="video-picker"
              value={currentEpisode.id}
              onChange={(e) => {
                const ep = episodes.find((item) => item.id === e.target.value);
                if (ep) onSelectEpisode(ep);
              }}
              className="min-w-0 w-full md:w-auto md:max-w-[300px] truncate bg-transparent text-[var(--color-ink)] text-sm font-sans rounded px-2 py-1.5 outline-none cursor-pointer"
            >
              {episodes.map((ep) => (
                <option
                  key={ep.id}
                  value={ep.id}
                  className="bg-[var(--color-surface)] text-[var(--color-ink)] py-1"
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
