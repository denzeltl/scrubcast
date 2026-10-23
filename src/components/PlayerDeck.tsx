"use client";

import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from "react";
import YouTube, { YouTubeProps } from "react-youtube";
import { Play, Pause, RotateCcw, RotateCw, Radio } from "lucide-react";
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

    const handleScrubBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!playerRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      seek(percentage * duration, false);
    };

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-deck)] rounded-2xl overflow-hidden shadow-xl flex flex-col">
        {/* Console Deck Top Bar */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#0f111a] border-b border-[var(--color-border-subtle)] text-xs font-mono">
          <div className="flex items-center gap-2 min-w-0 text-[var(--color-ink)]">
            <Radio className="w-3.5 h-3.5 shrink-0 text-[var(--color-accent-hover)]" />
            <span className="hidden sm:inline shrink-0 font-semibold uppercase tracking-wider text-[11px] text-[var(--color-ink)]">
              SYNCED VIEWPORT
            </span>
            <span className="hidden sm:inline text-[var(--color-ink-muted)]">|</span>
            <span className="min-w-0 text-[var(--color-ink-muted)] truncate max-w-[280px]">
              {episode.title}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border-deck)]">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
              <span className="text-[11px] text-[var(--color-accent-hover)] font-bold">
                {formatTimestamp(currentTime)}
              </span>
              <span className="text-[10px] text-[var(--color-ink-faint)]">
                / {formatTimestamp(duration)}
              </span>
            </div>
          </div>
        </div>

        {/* Video Player Viewport */}
        <div className="relative aspect-video w-full bg-black overflow-hidden group">
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
            <div className="absolute inset-0 flex items-center justify-center bg-[#0d0f15]/85 backdrop-blur-sm text-xs font-mono text-[var(--color-ink-muted)]">
              <span className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--color-accent)] animate-ping" />
                CONNECTING YOUTUBE STREAM...
              </span>
            </div>
          )}
        </div>

        {/* Interactive Scrub Timeline Bar with Citation Markers */}
        <div className="px-4 pt-3 pb-1.5 bg-[#0f121a]">
          <div
            onClick={handleScrubBarClick}
            className="relative h-2.5 w-full bg-[#1b202e] hover:bg-[#23293b] rounded-full cursor-pointer group transition-colors"
            title="Click anywhere to scrub playback"
          >
            {/* Played progress fill */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-accent)] rounded-full transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            />

            {/* Needle scrubber head */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-[var(--color-accent)] rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform"
              style={{ left: `${progressPercent}%` }}
            />

            {/* Semantic Citation Markers on Timeline */}
            {matches.map((m) => {
              const markerPos =
                duration > 0 ? (m.chunk.startTime / duration) * 100 : 0;
              return (
                <div
                  key={m.chunk.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    seek(m.chunk.startTime, true);
                  }}
                  className="absolute top-0 bottom-0 w-1.5 bg-[var(--color-secondary)] hover:bg-white rounded-full z-10 transition-transform hover:scale-y-150 cursor-pointer shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                  style={{ left: `${markerPos}%` }}
                  title={`[${formatTimestamp(m.chunk.startTime)}] ${m.chunk.speaker}: ${m.chunk.text.slice(0, 60)}...`}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-[var(--color-ink-faint)] mt-1.5">
            <span>00:00</span>
            <span className="text-[var(--color-secondary)] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-secondary)] inline-block" />
              BLUE PINS = VECTOR MATCHES
            </span>
            <span>{formatTimestamp(duration)}</span>
          </div>
        </div>

        {/* Transport Controls Deck */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f111a] border-t border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSkip(-10)}
              className="p-2 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-deck)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors active:scale-95 cursor-pointer"
              title="Seek back 10 seconds"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={handlePlayPause}
              className="px-4 py-2 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-md cursor-pointer"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>PAUSE</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>PLAY</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleSkip(10)}
              className="p-2 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-deck)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors active:scale-95 cursor-pointer"
              title="Seek forward 10 seconds"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-[var(--color-ink-muted)]">
            <span className="hidden sm:inline text-[var(--color-ink-faint)]">
              SPEAKER:
            </span>
            <span className="font-semibold text-[var(--color-ink)]">
              {episode.guest}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

PlayerDeck.displayName = "PlayerDeck";
