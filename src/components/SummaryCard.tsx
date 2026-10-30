"use client";

import React, { useState } from "react";
import { BookOpen, ChevronDown, Loader2, Play, AlertCircle, Eye } from "lucide-react";
import { SummaryChapter, SummaryStatus } from "@/types/podcast";
import { formatTimestamp } from "@/lib/time";
import { formatFriendlyErrorMessage } from "@/lib/errorUtils";

// Chapters shown before "Show all"
const COLLAPSED_CHAPTERS = 5;

interface SummaryCardProps {
  status: SummaryStatus | null;
  onSeek: (seconds: number) => void;
  activeSecond: number;
  hasCaptions?: boolean;
}

function activeChapterIndex(chapters: SummaryChapter[], second: number): number {
  let idx = -1;
  chapters.forEach((c, i) => {
    if (second >= c.startTime) idx = i;
  });
  return idx;
}

/**
 * "About this video": overview, main argument and clickable chapters, so the user
 * knows what the video covers before asking anything.
 */
export const SummaryCard: React.FC<SummaryCardProps> = ({ status, onSeek, activeSecond, hasCaptions = true }) => {
  const [showAll, setShowAll] = useState(false);
  const summary = status?.state === "ready" ? status.summary : null;
  const active = summary ? activeChapterIndex(summary.chapters, activeSecond) : -1;
  const chapters = summary
    ? showAll
      ? summary.chapters
      : summary.chapters.slice(0, COLLAPSED_CHAPTERS)
    : [];

  return (
    <section
      aria-label="About this video"
      className="bg-[var(--color-surface)] border border-[var(--color-border-deck)] rounded-2xl p-5 shadow-lg space-y-4"
    >
      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-[var(--color-secondary)]" />
        About this video
      </h3>

      {!hasCaptions || status?.state === "vision_only" ? (
        <div className="space-y-2 text-sm text-[var(--color-ink-muted)]">
          <div className="flex items-center gap-1.5 text-[var(--color-accent-hover)] font-semibold text-xs font-mono uppercase tracking-wider">
            <Eye className="w-3.5 h-3.5" />
            <span>Vision Mode Video</span>
          </div>
          <p className="text-[14px] leading-relaxed text-[var(--color-ink)]">
            This video has no caption track. Ask questions using{" "}
            <strong className="text-[var(--color-accent-hover)]">Watch Video (Vision)</strong> mode, and Gemini
            will watch and listen to the video directly.
          </p>
        </div>
      ) : !summary ? (
        <SummaryPending status={status} />
      ) : (
        <div className="space-y-4 animate-label-in">
          <p className="text-[15px] leading-relaxed text-[var(--color-ink)]">{summary.overview}</p>

          <div className="border-l-2 border-[var(--color-accent)] pl-3">
            <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-ink-faint)] mb-1">
              Main argument
            </p>
            <p className="text-sm leading-relaxed text-[var(--color-ink-muted)]">{summary.mainArgument}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-ink-faint)]">
              Chapters ({summary.chapters.length})
            </p>
            {chapters.map((chapter, i) => (
              <ChapterRow
                key={chapter.startTime}
                chapter={chapter}
                isActive={i === active}
                onSeek={onSeek}
              />
            ))}
            {summary.chapters.length > COLLAPSED_CHAPTERS && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                className="flex items-center gap-1 min-h-[44px] px-2 rounded-lg text-xs font-medium text-[var(--color-accent-hover)] cursor-pointer transition-[transform,color] duration-[140ms] ease-[cubic-bezier(0.16,1,0.3,1)] [@media(hover:hover)]:hover:text-[var(--color-ink)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-hover)]"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-[140ms] motion-reduce:transition-none ${
                    showAll ? "rotate-180" : ""
                  }`}
                />
                {showAll ? "Show fewer" : `Show all ${summary.chapters.length} chapters`}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

function ChapterRow({
  chapter,
  isActive,
  onSeek,
}: {
  chapter: SummaryChapter;
  isActive: boolean;
  onSeek: (seconds: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSeek(chapter.startTime)}
      title={chapter.summary}
      aria-current={isActive ? "true" : undefined}
      className={`group w-full min-h-[44px] text-left flex items-center gap-2.5 px-2 py-1.5 rounded-lg border cursor-pointer transition-[background-color,border-color,transform] duration-[140ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-hover)] motion-reduce:active:scale-100 ${
        isActive
          ? "bg-[var(--color-surface-active)] border-[var(--color-accent)]/60"
          : "border-transparent [@media(hover:hover)]:hover:bg-[var(--color-surface-hover)] [@media(hover:hover)]:hover:border-[var(--color-border-deck)]"
      }`}
    >
      <span
        className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[11px] font-bold tabular-nums transition-colors duration-[140ms] ${
          isActive
            ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
            : "bg-[var(--color-accent-faint)] text-[var(--color-accent-hover)] [@media(hover:hover)]:group-hover:bg-[var(--color-accent)] [@media(hover:hover)]:group-hover:text-[var(--color-accent-ink)]"
        }`}
      >
        <Play className="w-2.5 h-2.5 fill-current" />
        {formatTimestamp(chapter.startTime)}
      </span>
      <span className="min-w-0 text-sm font-semibold text-[var(--color-ink)] [overflow-wrap:anywhere]">
        {chapter.title}
      </span>
    </button>
  );
}

/** Progress, error or missing-key message while there's no summary to show */
function SummaryPending({ status }: { status: SummaryStatus | null }) {
  if (!status) {
    return <p className="text-sm text-[var(--color-ink-faint)]">Loading summary…</p>;
  }
  if (status.state === "running") {
    return (
      <p className="flex items-start gap-2 text-sm text-[var(--color-ink-muted)]" aria-live="polite">
        <Loader2 className="w-4 h-4 mt-0.5 animate-spin text-[var(--color-accent-hover)] shrink-0" />
        <span>
          Reading the whole video: section {Math.min(status.done + 1, status.total)} of {status.total}.
          Answers will use the overview and chapters once it&apos;s done. Long videos take a few minutes
          on Groq&apos;s free tier.
        </span>
      </p>
    );
  }
  if (status.state === "error") {
    return (
      <div
        role="alert"
        className="p-3.5 rounded-xl bg-[var(--color-deck-danger)]/10 border border-[var(--color-deck-danger)]/30 text-xs text-[var(--color-ink)] space-y-1.5"
      >
        <div className="flex items-center gap-2 font-semibold text-[var(--color-deck-danger)]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Couldn&apos;t summarize this video</span>
        </div>
        <p className="text-[var(--color-ink-muted)] leading-relaxed">
          {formatFriendlyErrorMessage(status.error)}
        </p>
        <p className="text-[11px] text-[var(--color-ink-faint)]">
          You can still ask questions about this video directly using the search bar above.
        </p>
      </div>
    );
  }
  if (status.state === "unavailable") {
    return (
      <p className="text-sm text-[var(--color-ink-muted)]">
        Add a Groq API key to <code className="font-mono text-xs">.env.local</code> to get an overview and
        chapters for each video.
      </p>
    );
  }
  return null;
}
