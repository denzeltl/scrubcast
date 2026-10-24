// Public facts about the site, shared by metadata, robots.txt, the sitemap and the manifest.

export const SITE_NAME = "Scrubcast";
export const SITE_TAGLINE = "Ask a video anything, jump to the answer";
export const SITE_DESCRIPTION =
  "Ask questions about any YouTube video. Scrubcast finds the moments that answer you, cites their timestamps, and jumps the player to the exact second.";

// Where visitors can get the code to run it themselves
export const SOURCE_URL = "https://github.com/denzeltl/scrubcast";

// Brand colours used outside CSS (browser UI, manifest)
export const THEME_COLOR = "#0a0b0a";

/**
 * The deployed site's origin, e.g. https://scrubcast.example.com. Read at request time
 * (not build time) so one Docker image works on any host. Set SITE_URL in production;
 * it's used for canonical links, share-image URLs and the sitemap.
 */
export function siteUrl(): URL {
  const raw = process.env.SITE_URL?.trim();
  try {
    if (raw) return new URL(raw.endsWith("/") ? raw : `${raw}/`);
  } catch {
    console.warn(`SITE_URL is not a valid URL: ${raw}`);
  }
  return new URL(`http://localhost:${process.env.PORT || 3000}/`);
}
