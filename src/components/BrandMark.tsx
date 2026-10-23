import React from "react";
import { markSvg } from "@/lib/brandMark";

// Rendered once at module load: the mark never changes
const LARGE = markSvg();
const SMALL = markSvg({ size: "small" });

/**
 * The Scrubcast mark. Uses the bigger-dot construction below 40px so it still reads.
 */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      // Our own generated SVG (src/lib/brandMark.ts), not user content
      dangerouslySetInnerHTML={{ __html: size < 40 ? SMALL : LARGE }}
    />
  );
}
