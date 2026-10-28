"use client";

import React, { useEffect, useRef, useState } from "react";
import { Zap, CheckCircle2, Loader2 } from "lucide-react";

type WarmupState = "pinging" | "slow" | "ready" | "hidden";

/**
 * Site-wide cold-start banner. On mount it pings /api/health:
 *  - If the response takes > 2 s, a subtle banner appears: "Waking up server…"
 *  - Once the server responds, it switches to "Server ready" then fades away.
 *  - If the response is fast (< 2 s), nothing is ever shown.
 */
export const ServerWarmupBanner: React.FC = () => {
  const [state, setState] = useState<WarmupState>("pinging");
  const slowTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const controller = new AbortController();

    // After 2 s of no response, show the "waking up" banner
    slowTimerRef.current = setTimeout(() => {
      setState("slow");
    }, 2000);

    fetch("/api/health", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(() => {
        clearTimeout(slowTimerRef.current);
        // Only transition to "ready" if the user already saw the banner
        setState((prev) => {
          if (prev === "slow") return "ready";
          // Fast response — never show anything
          return "hidden";
        });
      })
      .catch(() => {
        // Network error — stay on whatever state we're in, the real
        // request will surface the issue when the user interacts.
        clearTimeout(slowTimerRef.current);
        setState("hidden");
      });

    return () => {
      controller.abort();
      clearTimeout(slowTimerRef.current);
      clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Auto-hide 3 s after "ready"
  useEffect(() => {
    if (state !== "ready") return;
    hideTimerRef.current = setTimeout(() => {
      setState("hidden");
    }, 3000);
    return () => clearTimeout(hideTimerRef.current);
  }, [state]);

  if (state === "pinging" || state === "hidden") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        w-full flex items-center justify-center gap-2.5 px-4 py-2 text-xs font-mono
        transition-all duration-500
        ${
          state === "slow"
            ? "bg-[var(--color-accent-faint)] border-b border-[var(--color-accent)]/30 text-[var(--color-accent-hover)]"
            : "bg-[var(--color-deck-success)]/10 border-b border-[var(--color-deck-success)]/30 text-[var(--color-deck-success)]"
        }
      `}
    >
      {state === "slow" ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>
            <Zap className="w-3 h-3 inline -mt-0.5 mr-1" />
            Waking up server (free tier instance)… ready in a few seconds.
          </span>
        </>
      ) : (
        <>
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Server ready</span>
        </>
      )}
    </div>
  );
};
