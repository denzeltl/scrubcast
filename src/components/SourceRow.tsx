"use client";

import React, { useRef, useState } from "react";
import { AlertCircle, Link2, Loader2 } from "lucide-react";
import { PodcastEpisode } from "@/types/podcast";

interface SourceRowProps {
  currentEpisode: PodcastEpisode;
  // Resolves true once the video is indexed and selected
  onIngest: (url: string) => Promise<boolean>;
  isIngesting: boolean;
  error: string | null;
}

/**
 * Step one of the workflow: shows which video is being searched and takes a
 * YouTube link to index a different one.
 */
export const SourceRow: React.FC<SourceRowProps> = ({
  currentEpisode,
  onIngest,
  isIngesting,
  error,
}) => {
  const [url, setUrl] = useState("");
  const fieldRef = useRef<HTMLDivElement>(null);

  // One short shake when a link is rejected. Runs through the Web Animations API so it
  // replays on the same element (remounting would drop focus) and survives re-renders.
  // Reduced motion skips it; the red border and message still show.
  const shakeField = () => {
    const field = fieldRef.current;
    if (!field || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    field.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(4px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(2px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 280, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || isIngesting) return;
    if (await onIngest(trimmed)) {
      setUrl("");
    } else {
      shakeField();
    }
  };

  return (
    <section
      aria-label="Video source"
      className="bg-[var(--color-surface)] border border-[var(--color-border-deck)] rounded-xl p-3 sm:p-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center"
    >
      <div className="min-w-0">
        <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-ink-faint)]">
          Searching
        </p>
        <p
          className="text-sm font-semibold text-[var(--color-ink)] truncate"
          title={currentEpisode.title}
        >
          {currentEpisode.title}
        </p>
      </div>

      <div className="min-w-0 space-y-1.5">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div
            ref={fieldRef}
            className={`flex-1 min-w-0 flex items-center gap-2 bg-[var(--color-chassis)] border rounded-lg px-3 transition-[border-color,box-shadow] duration-[140ms] ease-[cubic-bezier(0.16,1,0.3,1)] focus-within:border-[var(--color-accent)] focus-within:ring-2 focus-within:ring-[var(--color-accent)]/20 ${
              error
                ? "border-[var(--color-deck-danger)]/60"
                : "border-[var(--color-border-deck)] [@media(hover:hover)]:hover:border-[var(--color-ink-faint)]"
            }`}
          >
            <Link2 className="w-4 h-4 text-[var(--color-ink-muted)] shrink-0" />
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              // readOnly, not disabled: disabling would blur the field and lose the caret after an error
              readOnly={isIngesting}
              aria-busy={isIngesting}
              placeholder="Or paste any YouTube link to search it"
              aria-label="YouTube link to index"
              aria-invalid={Boolean(error)}
              aria-describedby="source-row-status"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-[var(--color-ink)] placeholder-[var(--color-ink-faint)] outline-none read-only:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={isIngesting || !url.trim()}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-lg bg-[var(--color-accent)] text-white font-semibold text-xs cursor-pointer transition-[transform,background-color,box-shadow] duration-[140ms] ease-[cubic-bezier(0.16,1,0.3,1)] [@media(hover:hover)]:hover:bg-[var(--color-accent-hover)] [@media(hover:hover)]:hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-hover)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] disabled:opacity-40 disabled:translate-y-0 disabled:cursor-not-allowed motion-reduce:transition-colors motion-reduce:hover:translate-y-0"
          >
            {isIngesting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span key={isIngesting ? "busy" : "idle"} className="animate-label-in">
              {isIngesting ? "Indexing…" : "Index video"}
            </span>
          </button>
        </form>

        <div id="source-row-status" aria-live="polite">
          {isIngesting ? (
            <p className="text-xs text-[var(--color-ink-muted)]">
              Fetching captions and indexing them. A 3-hour episode takes about 20 seconds.
            </p>
          ) : error ? (
            <p
              role="alert"
              className="flex items-start gap-1.5 text-xs text-[var(--color-deck-danger)] [overflow-wrap:anywhere] animate-label-in"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
};
