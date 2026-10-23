"use client";

import React from "react";
import { cleanCaption } from "@/lib/captions";
import { SearchMatch } from "@/types/podcast";
import { formatTimestamp } from "@/lib/time";
import { Play, Activity, User } from "lucide-react";

interface SemanticMatchesProps {
  matches: SearchMatch[];
  onSeek: (seconds: number) => void;
  activeSecond: number;
}

export const SemanticMatches: React.FC<SemanticMatchesProps> = ({
  matches,
  onSeek,
  activeSecond,
}) => {
  if (matches.length === 0) return null;

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border-deck)] rounded-2xl p-5 shadow-lg space-y-3.5">
      <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2.5">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[var(--color-secondary)]" />
          Passages it drew on
        </h3>
        <span className="text-[11px] font-mono text-[var(--color-ink-faint)]">
          matched by meaning
        </span>
      </div>

      <div className="space-y-2">
        {matches.map((m) => {
          const percentage = Math.round(m.score * 100);
          const timecode = formatTimestamp(m.chunk.startTime);
          const isPlaying =
            activeSecond >= m.chunk.startTime &&
            activeSecond <= m.chunk.endTime;

          return (
            <div
              key={m.chunk.id}
              onClick={() => onSeek(m.chunk.startTime)}
              className={`group p-3 rounded-xl border transition-all cursor-pointer ${
                isPlaying
                  ? "bg-[var(--color-surface-active)] border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30"
                  : "bg-[var(--color-well)] border-[var(--color-border-deck)] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs font-mono mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-[var(--color-accent-faint)] text-[var(--color-accent-hover)] font-bold text-[11px] flex items-center gap-1">
                    <Play className="w-2.5 h-2.5 fill-current" />
                    [{timecode}]
                  </span>
                  {m.chunk.speaker !== "Speaker" && (
                    <span className="text-[var(--color-ink)] font-semibold flex items-center gap-1">
                      <User className="w-3 h-3 text-[var(--color-ink-muted)]" />
                      {m.chunk.speaker}
                    </span>
                  )}
                </div>

                {/* Similarity meter */}
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-[var(--color-secondary)] font-bold">
                    {percentage}% match
                  </span>
                  <div className="w-14 h-1.5 bg-[var(--color-track)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-accent)] rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>

              <p className="text-sm text-[var(--color-ink-muted)] group-hover:text-[var(--color-ink)] leading-relaxed transition-colors line-clamp-4 sm:line-clamp-none">
                {cleanCaption(m.chunk.text)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
