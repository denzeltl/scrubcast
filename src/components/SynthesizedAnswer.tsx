"use client";

import React from "react";
import { cleanCaption } from "@/lib/captions";
import { Sparkles, Play, Clock, Quote, AlertCircle } from "lucide-react";
import { SearchResult } from "@/types/podcast";
import { parseTimestampToSeconds } from "@/lib/time";

interface SynthesizedAnswerProps {
  searchResult: SearchResult;
  onSeek: (seconds: number) => void;
  activeSecond?: number;
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
}) => {
  const { answer, citations, latencyMs, isFallbackGroq, model } = searchResult;

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

        {/* Latency badge breakdown */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--color-ink-faint)] bg-[var(--color-chassis)] px-2.5 py-1 rounded-md border border-[var(--color-border-deck)]">
          <Clock className="w-3.5 h-3.5 text-[var(--color-ink-faint)]" />
          <span>Answered in {(latencyMs.total / 1000).toFixed(1)} s</span>
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
