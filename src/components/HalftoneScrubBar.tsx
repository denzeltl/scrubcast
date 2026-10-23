"use client";

import React, { useMemo, useRef, useState } from "react";
import { PodcastEpisode, SearchMatch } from "@/types/podcast";
import { formatTimestamp } from "@/lib/time";

// The brand mark stretched into the scrub bar: columns of dots whose height is how
// much is said at that moment (transcript words per second), amber where you've
// played, pale amber where the answer's passages are, a red playhead for now.

const COLUMNS = 100;
const ROWS = 7;
const STEP = 6; // viewBox units per dot cell
const W = COLUMNS * STEP;
const H = ROWS * STEP;
// Clicks this many columns from a passage snap to its start
const SNAP_COLUMNS = 1.5;

interface HalftoneScrubBarProps {
  episode: PodcastEpisode;
  duration: number;
  currentTime: number;
  matches: SearchMatch[];
  onSeek: (seconds: number, autoplay: boolean) => void;
}

/**
 * Speech density per column, 0.15..1. Silent stretches still show a thin line of
 * dots so the bar never looks broken.
 */
function densityEnvelope(episode: PodcastEpisode, duration: number): number[] {
  const words = new Array<number>(COLUMNS).fill(0);
  const span = duration / COLUMNS;
  for (const chunk of episode.chunks) {
    const length = Math.max(1, chunk.endTime - chunk.startTime);
    const perSecond = chunk.text.split(/\s+/).length / length;
    const first = Math.max(0, Math.floor(chunk.startTime / span));
    const last = Math.min(COLUMNS - 1, Math.floor(chunk.endTime / span));
    for (let c = first; c <= last; c++) words[c] = Math.max(words[c], perSecond);
  }
  const max = Math.max(...words, 0.001);
  return words.map((w) => 0.15 + 0.85 * Math.sqrt(w / max));
}

export function HalftoneScrubBar({ episode, duration, currentTime, matches, onSeek }: HalftoneScrubBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  // Bumped on every seek so the lit column re-runs its flash
  const [flash, setFlash] = useState<{ column: number; key: number } | null>(null);

  const envelope = useMemo(() => densityEnvelope(episode, duration), [episode, duration]);

  const matchColumns = useMemo(() => {
    const cols = new Map<number, number>(); // column -> passage start seconds
    for (const m of matches) {
      const first = Math.floor((m.chunk.startTime / duration) * COLUMNS);
      const last = Math.floor((m.chunk.endTime / duration) * COLUMNS);
      for (let c = first; c <= Math.min(COLUMNS - 1, last); c++) if (!cols.has(c)) cols.set(c, m.chunk.startTime);
    }
    return cols;
  }, [matches, duration]);

  // Dot geometry depends on the envelope and the answer; colour is applied per render.
  // Answer columns are drawn full height so they stand out from the speech density.
  const dots = useMemo(() => {
    const out: { cx: number; cy: number; r: number; column: number }[] = [];
    envelope.forEach((density, column) => {
      const env = matchColumns.has(column) ? Math.max(density, 1) : density;
      for (let row = 0; row < ROWS; row++) {
        const cy = row * STEP + STEP / 2;
        const fromCenter = Math.abs(cy - H / 2) / (H / 2);
        const r = Math.max(0, env - fromCenter) * STEP * 0.55;
        if (r > 0.35) out.push({ cx: column * STEP + STEP / 2, cy, r, column });
      }
    });
    return out;
  }, [envelope, matchColumns]);

  // One marker per answer passage, above the bar
  const markers = useMemo(
    () => [...new Set(matches.map((m) => m.chunk.startTime))].sort((a, b) => a - b),
    [matches]
  );

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const playedColumns = progress * COLUMNS;

  const seekTo = (seconds: number, autoplay: boolean) => {
    const clamped = Math.max(0, Math.min(duration, seconds));
    const column = Math.floor((clamped / duration) * COLUMNS);
    setFlash((prev) => ({ column, key: (prev?.key ?? 0) + 1 }));
    onSeek(clamped, autoplay);
  };

  const fractionAt = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handleClick = (e: React.MouseEvent) => {
    const fraction = fractionAt(e.clientX);
    const column = fraction * COLUMNS;
    // Snap to the nearest answer passage if the click landed on (or next to) one
    let snap: number | undefined;
    let best = Infinity;
    for (const [c, start] of matchColumns) {
      const d = Math.abs(c + 0.5 - column);
      if (d < SNAP_COLUMNS && d < best) {
        best = d;
        snap = start;
      }
    }
    if (snap !== undefined) seekTo(snap, true);
    else seekTo(fraction * duration, false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowRight: 5, ArrowLeft: -5, PageUp: 30, PageDown: -30 };
    if (e.key in keys) {
      e.preventDefault();
      seekTo(currentTime + keys[e.key], false);
    } else if (e.key === "Home") {
      e.preventDefault();
      seekTo(0, false);
    } else if (e.key === "End") {
      e.preventDefault();
      seekTo(duration - 1, false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div
        ref={barRef}
        role="slider"
        tabIndex={0}
        aria-label="Seek through the video"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        aria-valuetext={`${formatTimestamp(currentTime)} of ${formatTimestamp(duration)}`}
        onClick={handleClick}
        onKeyDown={handleKey}
        onMouseMove={(e) => setHover(fractionAt(e.clientX))}
        onMouseLeave={() => setHover(null)}
        className="relative w-full cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--color-well)]"
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full h-14" aria-hidden="true">
          {dots.map((d, i) => {
            const isMatch = matchColumns.has(d.column);
            const tone = isMatch
              ? "fill-[var(--color-secondary)]"
              : d.column < playedColumns
              ? "fill-[var(--color-accent)]"
              : "fill-[var(--color-accent-dim)]";
            return <circle key={i} cx={d.cx} cy={d.cy} r={d.r} className={tone} />;
          })}
        </svg>

        {/* Scrub Lock: the column playback snapped to lights up once */}
        {flash && (
          <span
            key={flash.key}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 rounded-sm bg-[var(--color-accent)] animate-lamp-flash"
            style={{ left: `${(flash.column / COLUMNS) * 100}%`, width: `${100 / COLUMNS}%` }}
          />
        )}

        {/* Answer markers: click to jump straight to that passage */}
        {markers.map((start) => (
          <button
            key={start}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              seekTo(start, true);
            }}
            aria-label={`Jump to answer at ${formatTimestamp(start)}`}
            title={formatTimestamp(start)}
            className="absolute z-10 -top-4 -translate-x-1/2 grid place-items-center w-5 h-4 cursor-pointer text-[var(--color-secondary)] transition-transform duration-[140ms] [@media(hover:hover)]:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-sm motion-reduce:transition-none"
            style={{ left: `${(start / duration) * 100}%` }}
          >
            <svg viewBox="0 0 10 8" width="10" height="8" aria-hidden="true">
              <path d="M0 0h10L5 8z" fill="currentColor" />
            </svg>
          </button>
        ))}

        {/* Hover position: pointer devices only */}
        {hover !== null && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-10 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[var(--color-surface-active)] border border-[var(--color-border-deck)] font-mono text-[11px] text-[var(--color-ink)] whitespace-nowrap [@media(hover:none)]:hidden"
            style={{ left: `${hover * 100}%` }}
          >
            {formatTimestamp(hover * duration)}
          </span>
        )}

        {/* Playhead: glides to a seek, then tracks playback */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-y-1 w-[3px] -translate-x-1/2 rounded-full bg-[var(--color-playhead)] shadow-[0_0_0_1.5px_var(--color-well),0_0_8px_var(--color-playhead)] transition-[left] duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          style={{ left: `${progress * 100}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 font-mono text-[11px] text-[var(--color-ink-faint)]">
        <span>00:00</span>
        {matches.length > 0 && (
          <span className="order-last basis-full sm:order-none sm:basis-auto flex items-center justify-center gap-1.5 text-[var(--color-ink-muted)] min-w-0">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-secondary)] shrink-0" aria-hidden="true" />
            Bright dots: moments that answer you
          </span>
        )}
        <span>{formatTimestamp(duration)}</span>
      </div>
    </div>
  );
}
