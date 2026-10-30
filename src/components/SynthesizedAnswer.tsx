"use client";

import React, { useState } from "react";
import { cleanCaption } from "@/lib/captions";
import { Sparkles, Play, Clock, Quote, AlertCircle, Copy, Check, Download, Globe, BookOpen } from "lucide-react";
import { ChatHistoryItem, EpisodeSummary, PodcastEpisode, SearchResult } from "@/types/podcast";
import { parseTimestampToSeconds } from "@/lib/time";

interface SynthesizedAnswerProps {
  searchResult: SearchResult;
  onSeek: (seconds: number) => void;
  activeSecond?: number;
  currentEpisode: PodcastEpisode;
  summary?: EpisodeSummary;
  history: ChatHistoryItem[];
}

/**
 * " ." or " ," after a citation chip would sit apart from it and could wrap onto its
 * own line; drop the space so the punctuation hugs the chip.
 */
function gluePunctuation(text: string): string {
  return text.replace(/^\s+(?=[.,;:!?)])/, "");
}

/**
 * The model may use **bold**; render it instead of showing asterisks
 */
function renderInline(text: string, keyBase: number): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={`b-${keyBase}-${i}`} className="font-semibold text-[var(--color-ink)]">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  );
}

export const SynthesizedAnswer: React.FC<SynthesizedAnswerProps> = ({
  searchResult,
  onSeek,
  activeSecond = 0,
  currentEpisode,
  summary,
  history,
}) => {
  const { answer, citations, latencyMs, isFallbackGroq, model, mode = "video_only" } = searchResult;
  const [copied, setCopied] = useState(false);

  const generateMarkdownNotes = () => {
    let md = `# Study Notes: ${currentEpisode.title}\n`;
    md += `Source: https://www.youtube.com/watch?v=${currentEpisode.youtubeId}\n`;
    md += `Channel: ${currentEpisode.showTitle}\n`;
    md += `Date: ${new Date().toLocaleDateString()}\n\n`;

    if (summary) {
      md += `## Video Overview\n${summary.overview}\n\n`;
      md += `## Main Argument\n${summary.mainArgument}\n\n`;
      if (summary.keyPoints?.length > 0) {
        md += `## Key Takeaways\n`;
        summary.keyPoints.forEach((kp) => {
          md += `- [${Math.floor(kp.seconds / 60)}:${String(kp.seconds % 60).padStart(2, "0")}] ${kp.text}\n`;
        });
        md += `\n`;
      }
    }

    md += `## Q&A Session (${mode === "hybrid" ? "Hybrid Mode" : "Video-Only Mode"})\n\n`;
    // Add past history if available
    if (history.length > 0) {
      history.forEach((h, idx) => {
        md += `### Q${idx + 1}: ${h.query}\n${h.answer}\n\n`;
      });
    }

    // Add current Q&A if not already last in history
    const lastHistory = history[history.length - 1];
    if (!lastHistory || lastHistory.query !== searchResult.query) {
      md += `### Q${history.length + 1}: ${searchResult.query}\n${searchResult.answer}\n\n`;
    }

    return md;
  };

  const handleCopyNotes = async () => {
    const text = generateMarkdownNotes();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadNotes = () => {
    const text = generateMarkdownNotes();
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const sanitizedTitle = currentEpisode.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    link.href = url;
    link.download = `${sanitizedTitle}-notes.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Render text and replace [MM:SS] with clickable citation buttons
  const renderSynthesizedText = (text: string) => {
    const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = timestampRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      const rawTimestamp = match[0]; // e.g. "[03:45]"
      const timeStr = match[1];      // e.g. "03:45"
      const seconds = parseTimestampToSeconds(timeStr);

      // Push text before the match (punctuation right after a previous chip stays glued to it)
      if (matchIndex > lastIndex) {
        parts.push(...renderInline(gluePunctuation(text.substring(lastIndex, matchIndex)), matchIndex));
      }

      // Check if this citation is currently playing (within 8s window)
      const isActive = Math.abs(activeSecond - seconds) < 8;

      parts.push(
        <button
          key={`chip-${matchIndex}`}
          onClick={() => onSeek(seconds)}
          className={`inline-flex items-center gap-1 ml-1 px-2.5 py-0.5 rounded-md font-mono text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 shadow-sm ${
            isActive
              ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] ring-2 ring-[var(--color-accent)]/50 animate-iris-pulse"
              : "bg-[var(--color-surface-active)] border border-[var(--color-accent)]/40 text-[var(--color-accent-hover)] hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-ink)]"
          }`}
          title={`Click to jump playback to ${timeStr}`}
        >
          <Play className="w-2.5 h-2.5 fill-current" />
          <span>{rawTimestamp}</span>
        </button>
      );

      lastIndex = timestampRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(...renderInline(gluePunctuation(text.substring(lastIndex)), lastIndex));
    }

    return parts;
  };

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border-deck)] rounded-2xl p-6 shadow-xl space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[var(--color-accent-faint)] text-[var(--color-accent-hover)] border border-[var(--color-accent)]/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3
              className="font-display text-base font-extrabold tracking-[-0.02em] text-[var(--color-ink)]"
              title={isFallbackGroq ? "Closest passages, quoted" : `Written by ${model ?? "an LLM"} on Groq`}
            >
              {isFallbackGroq ? "Closest passages" : "Answer"}
            </h3>
            <p className="text-xs text-[var(--color-ink-muted)]">
              Written from what&apos;s said in the video. Click a timestamp to jump there.
            </p>
          </div>
        </div>

        {/* Action Controls: Mode indicator, Copy notes, Download notes, and Latency */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded-md border border-[var(--color-border-deck)] bg-[var(--color-surface-active)] text-[var(--color-ink-muted)]">
            {mode === "hybrid" ? (
              <span className="flex items-center gap-1 text-[var(--color-accent-hover)]">
                <Globe className="w-3 h-3" /> Hybrid
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> Video only
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleCopyNotes}
            className="flex items-center gap-1 text-[11px] font-mono text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] bg-[var(--color-chassis)] hover:bg-[var(--color-surface-hover)] px-2.5 py-1 rounded-md border border-[var(--color-border-deck)] transition-colors cursor-pointer"
            title="Copy Study Notes as Markdown"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-[var(--color-deck-success)]" />
                <span className="text-[var(--color-deck-success)]">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Notes</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadNotes}
            className="flex items-center gap-1 text-[11px] font-mono text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] bg-[var(--color-chassis)] hover:bg-[var(--color-surface-hover)] px-2.5 py-1 rounded-md border border-[var(--color-border-deck)] transition-colors cursor-pointer"
            title="Download Notes (.md)"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--color-ink-faint)] bg-[var(--color-chassis)] px-2.5 py-1 rounded-md border border-[var(--color-border-deck)]">
            <Clock className="w-3.5 h-3.5 text-[var(--color-ink-faint)]" />
            <span>{(latencyMs.total / 1000).toFixed(1)} s</span>
          </div>
        </div>
      </div>

      {/* Groq Missing notice if in fallback */}
      {isFallbackGroq && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--color-accent-faint)] border border-[var(--color-accent)]/30 text-xs text-[var(--color-ink)]">
          <AlertCircle className="w-4 h-4 text-[var(--color-accent-hover)] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-[var(--color-accent-hover)]">
              No LLM answer: showing the closest transcript passages instead.
            </span>
            <p className="text-[var(--color-ink-muted)] text-[11px]">
              Either no Groq API key is set or the Groq call failed. For written answers, add your free key to{" "}
              <code className="text-[var(--color-ink)] font-mono bg-black/40 px-1 py-0.5 rounded">.env.local</code> as{" "}
              <code className="text-[var(--color-ink)] font-mono bg-black/40 px-1 py-0.5 rounded">GROQ_API_KEY=gsk_...</code>.
            </p>
          </div>
        </div>
      )}

      {/* Main synthesized answer text with generous 16px body */}
      <div className="text-[15px] md:text-base leading-relaxed text-[var(--color-ink)] font-sans space-y-3">
        <div className="whitespace-pre-line">
          {renderSynthesizedText(answer)}
        </div>
      </div>

      {/* Citation Sources Footnotes */}
      {citations.length > 0 && (
        <div className="border-t border-[var(--color-border-subtle)] pt-4 space-y-2.5">
          <h4 className="text-xs font-mono font-semibold uppercase text-[var(--color-ink-muted)] tracking-wider flex items-center gap-1.5">
            <Quote className="w-3.5 h-3.5 text-[var(--color-secondary)]" />
            Where it&apos;s said ({citations.length})
          </h4>
          <div className="grid grid-cols-1 gap-2.5">
            {citations.map((c, idx) => (
              <button
                key={idx}
                onClick={() => onSeek(c.seconds)}
                className="group flex flex-col text-left p-3 rounded-xl bg-[var(--color-well)] border border-[var(--color-border-deck)] border-l-2 border-l-[var(--color-accent)] hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-surface-hover)] transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-center justify-between text-xs font-mono mb-1">
                  <span className="font-bold text-[var(--color-accent-hover)] flex items-center gap-1">
                    <Play className="w-2.5 h-2.5 fill-current" />
                    [{c.timestamp}]
                  </span>
                  <span className="text-[11px] text-[var(--color-ink-muted)]">
                    {c.speaker === "Speaker" ? "" : c.speaker}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-ink-muted)] group-hover:text-[var(--color-ink)] line-clamp-2 transition-colors italic">
                  &ldquo;{cleanCaption(c.snippet)}&rdquo;
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
