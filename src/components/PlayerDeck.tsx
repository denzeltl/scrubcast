"use client";

import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from "react";
import YouTube, { YouTubeProps } from "react-youtube";
import { Play, Pause, RotateCcw, RotateCw } from "lucide-react";
import { HalftoneScrubBar } from "@/components/HalftoneScrubBar";
import { PodcastEpisode, SearchMatch } from "@/types/podcast";
import { formatTimestamp } from "@/lib/time";

export interface PlayerDeckHandle {
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
}

// The subset of the YouTube IFrame player API this deck calls.
// react-youtube types event.target as the promisified wrapper, but onReady hands us the raw player.
interface YouTubeIFramePlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  getDuration(): number;
}

const YT_PLAYING = 1;

interface PlayerDeckProps {
  episode: PodcastEpisode;
  matches: SearchMatch[];
  onTimeUpdate: (seconds: number) => void;
}

export const PlayerDeck = forwardRef<PlayerDeckHandle, PlayerDeckProps>(
  ({ episode, matches, onTimeUpdate }, ref) => {
    const playerRef = useRef<YouTubeIFramePlayer | null>(null);
    // A seek requested before the iframe finished loading; applied in onReady
    const pendingSeekRef = useRef<number | null>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(episode.duration || 3600);
    const [isPlayerReady, setIsPlayerReady] = useState<boolean>(false);

    const seek = (seconds: number, autoplay: boolean) => {
      const target = Math.max(0, Math.min(duration, seconds));
      setCurrentTime(target);
      onTimeUpdate(target);
      const player = playerRef.current;
      if (!player) {
        pendingSeekRef.current = target;
        return;
      }
      player.seekTo(target, true);
      if (autoplay) player.playVideo();
    };

    // Provide imperative handle for parent or citation clicks to seek
    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => seek(seconds, true),
      play: () => playerRef.current?.playVideo(),
      pause: () => playerRef.current?.pauseVideo(),
    }));

    // Poll current time when playing
    useEffect(() => {
      if (!isPlaying) return;
      const interval = setInterval(() => {
        try {
          const time = playerRef.current?.getCurrentTime();
          if (typeof time === "number") {
            setCurrentTime(time);
            onTimeUpdate(time);
          }
        } catch {
          // Player might be unmounting
        }
      }, 500);
      return () => clearInterval(interval);
    }, [isPlaying, onTimeUpdate]);

    const onReady: YouTubeProps["onReady"] = (event) => {
      const player = event.target as unknown as YouTubeIFramePlayer;
      playerRef.current = player;
      setIsPlayerReady(true);
      try {
        const d = player.getDuration();
        if (d && d > 0) setDuration(d);
      } catch {}
      if (pendingSeekRef.current !== null) {
        player.seekTo(pendingSeekRef.current, true);
        player.playVideo();
        pendingSeekRef.current = null;
      }
    };

    const onStateChange: YouTubeProps["onStateChange"] = (event) => {
      setIsPlaying(event.data === YT_PLAYING);
    };

    const handlePlayPause = () => {
      if (!playerRef.current) return;
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    };

    const handleSkip = (deltaSeconds: number) => {
      if (!playerRef.current) return;
      seek(currentTime + deltaSeconds, false);
    };

    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-deck)] rounded-2xl overflow-hidden shadow-xl flex flex-col">
        {/* Deck top bar: title and the live timecode readout */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[var(--color-well)] border-b border-[var(--color-border-subtle)]">
          <p className="min-w-0 truncate text-sm font-medium text-[var(--color-ink)]" title={episode.title}>
            {episode.title}
          </p>
          <p className="shrink-0 font-mono text-[var(--color-ink-faint)] text-xs" aria-label="Playback position">
            <span className="text-base font-semibold text-[var(--color-accent)]">{formatTimestamp(currentTime)}</span>
            {" / "}
            {formatTimestamp(duration)}
          </p>
        </div>

        {/* Video */}
        <div
          className="relative aspect-video w-full bg-black bg-cover bg-center overflow-hidden"
          style={{ backgroundImage: `url(https://i.ytimg.com/vi/${episode.youtubeId}/hqdefault.jpg)` }}
        >
          <YouTube
            videoId={episode.youtubeId}
            onReady={onReady}
            onStateChange={onStateChange}
            opts={{
              width: "100%",
              height: "100%",
              playerVars: {
                autoplay: 0,
                modestbranding: 1,
                rel: 0,
              },
            }}
            className="w-full h-full"
            iframeClassName="w-full h-full absolute inset-0"
          />

          {!isPlayerReady && (
            <div className="absolute inset-0 flex items-end justify-start p-3 bg-gradient-to-t from-[var(--color-chassis)]/80 to-transparent text-xs font-mono text-[var(--color-ink-muted)]">
              <span className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-playhead)] animate-pulse motion-reduce:animate-none" />
                Loading video…
              </span>
            </div>
          )}
        </div>

        {/* Halftone scrub bar: the signature */}
        <div className="px-4 pt-9 pb-2 bg-[var(--color-well)]">
          <HalftoneScrubBar
            episode={episode}
            duration={duration}
            currentTime={currentTime}
            matches={matches}
            onSeek={seek}
          />
        </div>

        {/* Transport */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[var(--color-well)] border-t border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSkip(-10)}
              aria-label="Back 10 seconds"
              title="Back 10 seconds"
              className="group grid place-items-center w-11 h-11 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-deck)] text-[var(--color-ink-muted)] cursor-pointer transition-[color,background-color,transform] duration-[140ms] [@media(hover:hover)]:hover:text-[var(--color-ink)] [@media(hover:hover)]:hover:bg-[var(--color-surface-hover)] active:scale-[0.92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <RotateCcw className="w-4 h-4 transition-transform duration-[140ms] [@media(hover:hover)]:group-hover:-rotate-12 motion-reduce:transition-none" />
            </button>

            <button
              type="button"
              onClick={handlePlayPause}
              className="h-11 px-5 rounded-lg bg-[var(--color-accent)] text-[var(--color-accent-ink)] font-display font-extrabold text-sm tracking-[-0.01em] flex items-center gap-2 cursor-pointer transition-[background-color,transform] duration-[140ms] ease-[cubic-bezier(0.16,1,0.3,1)] [@media(hover:hover)]:hover:bg-[var(--color-accent-hover)] [@media(hover:hover)]:hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-well)] motion-reduce:hover:translate-y-0"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span key={isPlaying ? "pause" : "play"} className="animate-label-in">
                {isPlaying ? "Pause" : "Play"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSkip(10)}
              aria-label="Forward 10 seconds"
              title="Forward 10 seconds"
              className="group grid place-items-center w-11 h-11 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-deck)] text-[var(--color-ink-muted)] cursor-pointer transition-[color,background-color,transform] duration-[140ms] [@media(hover:hover)]:hover:text-[var(--color-ink)] [@media(hover:hover)]:hover:bg-[var(--color-surface-hover)] active:scale-[0.92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <RotateCw className="w-4 h-4 transition-transform duration-[140ms] [@media(hover:hover)]:group-hover:rotate-12 motion-reduce:transition-none" />
            </button>
          </div>

          <p className="min-w-0 truncate text-xs text-[var(--color-ink-muted)]">{episode.showTitle}</p>
        </div>
      </div>
    );
  }
);

PlayerDeck.displayName = "PlayerDeck";
