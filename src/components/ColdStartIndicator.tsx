"use client";

import React from "react";
import { Sparkles, Clock, Server, Cpu, MessageSquareText, Check, Eye, Film } from "lucide-react";

interface ColdStartIndicatorProps {
  isLoading: boolean;
  elapsedSec: number;
  engineMode?: "transcript" | "vision";
}

/**
 * Format elapsed seconds as MM:SS for tape deck instrument readouts.
 */
function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}s`;
}

/**
 * Full card shown in the left answer column when no answer exists yet.
 * If elapsedSec >= 2.5, it transitions into an active broadcast telemetry panel.
 */
export const ColdStartIndicator: React.FC<ColdStartIndicatorProps> = ({
  isLoading,
  elapsedSec,
  engineMode = "transcript",
}) => {
  const isVision = engineMode === "vision";

  // Not searching: standard idle guidance card
  if (!isLoading) {
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-deck)] rounded-2xl p-8 text-center text-sm text-[var(--color-ink-muted)] space-y-3 shadow-lg">
        {isVision ? (
          <Eye className="w-6 h-6 mx-auto text-[var(--color-accent-hover)]" />
        ) : (
          <Sparkles className="w-6 h-6 mx-auto text-[var(--color-accent-hover)]" />
        )}
        <p>
          {isVision
            ? "Ask a question about what is shown or said in the video. Gemini will watch the video and cite clickable timestamps."
            : "Ask a question above. The answer cites timestamps you can click to jump the video to that moment."}
        </p>
      </div>
    );
  }

  const isColdStart = elapsedSec >= 2.5;

  // Fast query (< 2.5s): subtle searching skeleton
  if (!isColdStart) {
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-deck)] rounded-2xl p-6 shadow-xl space-y-5 animate-pulse">
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--color-accent-faint)] text-[var(--color-accent-hover)]">
              {isVision ? <Eye className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div>
              <div className="h-4 w-32 bg-[var(--color-surface-active)] rounded" />
              <div className="h-3 w-48 bg-[var(--color-surface-hover)] rounded mt-1.5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--color-ink-faint)] bg-[var(--color-chassis)] px-2.5 py-1 rounded-md border border-[var(--color-border-deck)]">
            <Clock className="w-3.5 h-3.5" />
            <span>{isVision ? "Watching video stream…" : "Searching transcript…"}</span>
          </div>
        </div>

        {/* Skeleton content lines */}
        <div className="space-y-3 pt-1">
          <div className="h-4 w-5/6 bg-[var(--color-surface-active)] rounded" />
          <div className="h-4 w-full bg-[var(--color-surface-active)] rounded" />
          <div className="h-4 w-3/4 bg-[var(--color-surface-active)] rounded" />
        </div>
      </div>
    );
  }

  // Active Loading Telemetry Panel (>= 2.5s)
  // Vision Mode: YouTube streaming -> Multimodal frame analysis -> Answer synthesis
  // Transcript Mode: Container spin-up -> ONNX vector model loading -> Answer synthesis
  const isStage1Done = elapsedSec > 5;
  const isStage2Done = elapsedSec > 12;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-[var(--color-surface)] border border-[var(--color-accent)]/30 rounded-2xl p-6 shadow-2xl space-y-5 transition-all duration-300"
    >
      {/* Deck Header: Telemetry indicator & Clock */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="relative p-2 rounded-lg bg-[var(--color-accent-faint)] text-[var(--color-accent)] border border-[var(--color-accent)]/30">
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--color-accent)] animate-ping" />
            {isVision ? <Eye className="w-4 h-4" /> : <Server className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
                {isVision ? "Gemini Multimodal Vision" : "Render Cold Start"}
              </span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
            </div>
            <h3 className="font-display text-base font-extrabold text-[var(--color-ink)]">
              {isVision ? "Watching & analyzing video stream…" : "Waking up server instance…"}
            </h3>
          </div>
        </div>

        {/* Elapsed Timer Readout */}
        <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-[var(--color-accent)] bg-[var(--color-well)] px-3 py-1.5 rounded-md border border-[var(--color-border-deck)]">
          <Clock className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          <span>WAIT {formatElapsed(elapsedSec)}</span>
        </div>
      </div>

      {/* Broadcast Halftone Pulse Rhythm */}
      <div className="p-3.5 rounded-xl bg-[var(--color-well)] border border-[var(--color-border-deck)] space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono text-[var(--color-ink-muted)]">
          <span>PIPELINE TELEMETRY</span>
          <span className="text-[var(--color-accent-hover)] font-semibold">
            {isVision
              ? isStage2Done
                ? "Grounded Synthesis"
                : isStage1Done
                ? "Frame & Audio Analysis"
                : "YouTube Connection"
              : isStage2Done
              ? "Groq Inference"
              : isStage1Done
              ? "Vector Pipeline"
              : "Container Boot"}
          </span>
        </div>

        {/* Dot matrix wave */}
        <div className="flex items-center justify-between gap-1 py-1">
          {Array.from({ length: 16 }).map((_, i) => {
            const activeWave = (Math.floor(elapsedSec * 3) + i) % 16;
            const isLit = activeWave < 6;
            return (
              <div
                key={i}
                className={`h-4 w-1.5 rounded-full transition-all duration-150 ${
                  isLit
                    ? "bg-[var(--color-accent)] opacity-100 scale-y-110"
                    : "bg-[var(--color-accent-dim)] opacity-40"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Instrument Stage Checklist */}
      <div className="space-y-2 text-xs font-mono">
        {/* Stage 1 */}
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--color-chassis)] border border-[var(--color-border-deck)]">
          <div
            className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
              isStage1Done
                ? "bg-[var(--color-deck-success)]/15 text-[var(--color-deck-success)] border border-[var(--color-deck-success)]/30"
                : "bg-[var(--color-accent-faint)] text-[var(--color-accent)] border border-[var(--color-accent)]/30"
            }`}
          >
            {isStage1Done ? (
              <Check className="w-3 h-3 stroke-[3]" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-ping" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-[var(--color-ink)]">
              {isVision ? "1. YouTube Stream Access" : "1. Web Service Container"}
            </span>
            <span className="text-[var(--color-ink-muted)] ml-2">
              {isVision
                ? isStage1Done
                  ? "Connected directly to stream"
                  : "Connecting to public video stream…"
                : isStage1Done
                ? "Booted & ready"
                : "Resuming from 15m inactivity sleep…"}
            </span>
          </div>
        </div>

        {/* Stage 2 */}
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--color-chassis)] border border-[var(--color-border-deck)]">
          <div
            className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
              isStage2Done
                ? "bg-[var(--color-deck-success)]/15 text-[var(--color-deck-success)] border border-[var(--color-deck-success)]/30"
                : isStage1Done
                ? "bg-[var(--color-accent-faint)] text-[var(--color-accent)] border border-[var(--color-accent)]/30"
                : "bg-[var(--color-surface-active)] text-[var(--color-ink-faint)] border border-[var(--color-border-deck)]"
            }`}
          >
            {isStage2Done ? (
              <Check className="w-3 h-3 stroke-[3]" />
            ) : isStage1Done ? (
              isVision ? (
                <Film className="w-3 h-3 animate-pulse text-[var(--color-accent)]" />
              ) : (
                <Cpu className="w-3 h-3 animate-spin text-[var(--color-accent)]" />
              )
            ) : isVision ? (
              <Film className="w-3 h-3" />
            ) : (
              <Cpu className="w-3 h-3" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-[var(--color-ink)]">
              {isVision ? "2. Multimodal Frame Analysis" : "2. Vector Embedding Engine"}
            </span>
            <span className="text-[var(--color-ink-muted)] ml-2">
              {isVision
                ? isStage2Done
                  ? "Visual & audio timeline processed"
                  : isStage1Done
                  ? "Analyzing visual frames, slides and audio…"
                  : "Queued"
                : isStage2Done
                ? "384-d ONNX pipeline warm"
                : isStage1Done
                ? "Initializing transformer weights…"
                : "Queued"}
            </span>
          </div>
        </div>

        {/* Stage 3 */}
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--color-chassis)] border border-[var(--color-border-deck)]">
          <div
            className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
              isStage2Done
                ? "bg-[var(--color-accent-faint)] text-[var(--color-accent)] border border-[var(--color-accent)]/30"
                : "bg-[var(--color-surface-active)] text-[var(--color-ink-faint)] border border-[var(--color-border-deck)]"
            }`}
          >
            <MessageSquareText
              className={`w-3 h-3 ${isStage2Done ? "text-[var(--color-accent)] animate-pulse" : ""}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-[var(--color-ink)]">
              {isVision ? "3. Answer & Citation Synthesis" : "3. Answer Synthesis"}
            </span>
            <span className="text-[var(--color-ink-muted)] ml-2">
              {isVision
                ? isStage2Done
                  ? "Synthesizing answer with [MM:SS] clickable chips…"
                  : "Awaiting visual pass"
                : isStage2Done
                ? "Ranking video passages on Groq…"
                : "Awaiting model init"}
            </span>
          </div>
        </div>
      </div>

      {/* Helpful context footnote */}
      <div className="border-l-2 border-l-[var(--color-accent)] pl-3 text-xs text-[var(--color-ink-muted)] space-y-1">
        <p className="font-medium text-[var(--color-ink)]">
          {isVision ? "Watching the full video" : "Why the delay?"}
        </p>
        <p>
          {isVision
            ? "Gemini directly watches visual frames and listens to audio from YouTube. Multimodal analysis typically takes 10–25 seconds depending on video length."
            : "Render's free tier spins down after 15 minutes of inactivity. Cold starts take ~20–35 seconds. Once awake, all subsequent questions answer in 1–2 seconds."}
        </p>
      </div>
    </div>
  );
};

/**
 * Top floating banner shown when searching if a previous result is already on screen.
 */
export const ColdStartBanner: React.FC<{
  elapsedSec: number;
  engineMode?: "transcript" | "vision";
}> = ({ elapsedSec, engineMode = "transcript" }) => {
  const isVision = engineMode === "vision";

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-accent)]/40 shadow-xl flex items-center justify-between gap-3 text-xs transition-all animate-label-in"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative w-3 h-3 rounded-full bg-[var(--color-accent)] shrink-0">
          <span className="absolute inset-0 rounded-full bg-[var(--color-accent)] animate-ping opacity-75" />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-bold text-[var(--color-accent-hover)] uppercase tracking-wider truncate">
            {isVision ? "Watching & analyzing video stream…" : "Waking up server instance…"}
          </p>
          <p className="text-[11px] text-[var(--color-ink-muted)] truncate">
            {isVision
              ? "Gemini is watching visual frames and listening to audio (~10–25s). Answer will appear automatically."
              : "Render free-tier instance resuming (~20–35s). Answer will update automatically."}
          </p>
        </div>
      </div>

      <div className="shrink-0 font-mono text-xs text-[var(--color-accent)] bg-[var(--color-well)] border border-[var(--color-border-deck)] px-2.5 py-1 rounded-md">
        {formatElapsed(elapsedSec)}
      </div>
    </div>
  );
};
