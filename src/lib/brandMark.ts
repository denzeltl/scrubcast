// The Scrubcast mark: a halftone waveform (columns of dots sized by a wave envelope)
// cut by a red playhead. Shared by the in-app <BrandMark>, scripts/build-brand.ts
// (logo + favicon files) and the halftone scrub bar, so they always match.

export const BRAND = {
  deck: "#0a0b0a",
  panel: "#121412",
  paper: "#efece2",
  amber: "#ffb020",
  amberDim: "#5c4310",
  playhead: "#ff4d3d",
} as const;

export interface Dot {
  cx: number;
  cy: number;
  r: number;
  /** 0..1 position along the wave, for colouring played vs unplayed */
  t: number;
}

/**
 * Dots for a halftone wave filling a w×h box. envelope(t) is the wave height at
 * position t (0..1), from 0 (nothing) to ~1 (full height).
 */
export function halftoneWave(
  w: number,
  h: number,
  step: number,
  envelope: (t: number) => number
): Dot[] {
  const dots: Dot[] = [];
  for (let x = step / 2; x < w; x += step) {
    const t = x / w;
    const env = envelope(t);
    for (let y = step / 2; y < h; y += step) {
      const fromCenter = Math.abs(y - h / 2) / (h / 2);
      const r = Math.max(0, env - fromCenter) * step * 0.55;
      if (r > 0.35) dots.push({ cx: round(x), cy: round(y), r: round(r), t });
    }
  }
  return dots;
}

/** The logo's fixed wave shape */
export const markEnvelope = (t: number) =>
  (Math.abs(Math.sin(t * Math.PI * 3.1)) * 0.65 + 0.35 * Math.abs(Math.sin(t * 23))) * 1.05;

// Where the playhead cuts the wave in the mark (dots before it are lit)
const MARK_PLAYHEAD_T = 0.58;

/**
 * Mark as an SVG fragment in a 96×96 viewBox.
 * `size: "small"` uses bigger dots so it still reads at 16-32px.
 */
export function markSvg({
  background = true,
  size = "large",
  lit = BRAND.amber,
  unlit = BRAND.amberDim,
  playhead = BRAND.playhead,
  panel = BRAND.panel,
}: {
  background?: boolean;
  size?: "large" | "small";
  lit?: string;
  unlit?: string;
  playhead?: string;
  panel?: string;
} = {}): string {
  const small = size === "small";
  const box = small ? { x: 12, y: 22, w: 72, h: 52, step: 12 } : { x: 10, y: 18, w: 76, h: 60, step: 7 };
  const dots = halftoneWave(box.w, box.h, box.step, markEnvelope)
    .map(
      (d) =>
        `<circle cx="${round(d.cx + box.x)}" cy="${round(d.cy + box.y)}" r="${d.r}" fill="${
          d.t < MARK_PLAYHEAD_T ? lit : unlit
        }"/>`
    )
    .join("");
  const bar = small
    ? `<rect x="52" y="12" width="8" height="72" rx="4" fill="${playhead}"/>`
    : `<rect x="53" y="12" width="5" height="72" rx="2.5" fill="${playhead}"/>`;
  const bg = background ? `<rect width="96" height="96" rx="22" fill="${panel}"/>` : "";
  return bg + dots + bar;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
