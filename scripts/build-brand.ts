import fs from "fs";
import path from "path";
import { BRAND, markSvg } from "../src/lib/brandMark";

// Writes the brand files from the same mark the app renders:
//   brand/mark.svg, logo.svg, logo-mono.svg, logo-inverse.svg, favicon.svg
//   src/app/icon.svg (Next.js serves it as the favicon)
// Run: npx tsx scripts/build-brand.ts

const root = path.resolve(__dirname, "..");
const out = (file: string, svg: string) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), svg.trim() + "\n", "utf-8");
  console.log("✓", file);
};

const svg = (viewBox: string, body: string, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${label}">${body}</svg>`;

// The wordmark is Inter Tight 800. Kept as text so the file stays small and editable;
// convert to outlines in a design tool if a printer needs it.
const wordmark = (fill: string) =>
  `<text x="116" y="66" font-family="'Inter Tight', 'Inter', system-ui, sans-serif" font-weight="800" font-size="60" letter-spacing="-2.7" fill="${fill}">Scrubcast</text>`;

const mark = markSvg();
const monoMark = markSvg({ background: false, lit: BRAND.deck, unlit: "#9a9a92", playhead: BRAND.deck });
const inverseMark = markSvg({ panel: BRAND.paper, unlit: "#d8c79a" });

out("brand/mark.svg", svg("0 0 96 96", mark, "Scrubcast"));
out("brand/favicon.svg", svg("0 0 96 96", markSvg({ size: "small" }), "Scrubcast"));
out("brand/logo.svg", svg("0 0 420 96", mark + wordmark(BRAND.paper), "Scrubcast"));
out("brand/logo-inverse.svg", svg("0 0 420 96", inverseMark + wordmark(BRAND.deck), "Scrubcast"));
out("brand/logo-mono.svg", svg("0 0 420 96", monoMark + wordmark(BRAND.deck), "Scrubcast"));
out("src/app/icon.svg", svg("0 0 96 96", markSvg({ size: "small" }), "Scrubcast"));
