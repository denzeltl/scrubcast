/**
 * Tidy caption text for display. YouTube captions mark a change of speaker with a
 * hyphen ("- All right…", "…for this? - Yeah."), and empty turns leave "- -".
 * Shown as-is that reads like broken punctuation.
 */
export function cleanCaption(text: string): string {
  return text
    .replace(/(^|\s)-(\s+-)+(?=\s|$)/g, "$1") // "- -" runs from empty turns
    .replace(/^\s*-\s+/, "") // leading speaker dash
    .replace(/\s+-\s+(?=\S)/g, " — ") // mid-text speaker change
    .replace(/(\w)-\s+—/g, "$1 —") // a word cut off at the change: "by- — Okay" -> "by — Okay"
    .replace(/\s{2,}/g, " ")
    .trim();
}
