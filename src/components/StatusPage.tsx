import React from "react";
import { BrandMark } from "@/components/BrandMark";

/**
 * Full-page message in the brand look, for 404s and errors: a big timecode-style code,
 * one line saying what happened, and a way back.
 */
export function StatusPage({
  code,
  title,
  message,
  action,
}: {
  code: string;
  title: string;
  message: string;
  action: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-16 bg-[var(--color-chassis)] text-[var(--color-ink)]">
      <div className="w-full max-w-md text-center space-y-5">
        <BrandMark size={56} className="mx-auto" />
        <p className="font-mono text-4xl font-semibold text-[var(--color-accent)]">{code}</p>
        <h1 className="font-display text-2xl font-extrabold tracking-[-0.03em] text-balance">{title}</h1>
        <p className="text-[var(--color-ink-muted)] text-pretty">{message}</p>
        <div className="pt-2">{action}</div>
      </div>
    </main>
  );
}

export const statusActionClass =
  "inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg bg-[var(--color-accent)] text-[var(--color-accent-ink)] font-display font-extrabold text-sm cursor-pointer transition-[transform,background-color] duration-[140ms] ease-[cubic-bezier(0.16,1,0.3,1)] [@media(hover:hover)]:hover:bg-[var(--color-accent-hover)] [@media(hover:hover)]:hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-chassis)] motion-reduce:hover:translate-y-0";
