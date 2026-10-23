/**
 * Format seconds into MM:SS or HH:MM:SS format
 */
export function formatTimestamp(seconds: number): string {
  const totalSecs = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Parse [MM:SS] or [HH:MM:SS] to seconds
 */
export function parseTimestampToSeconds(timestamp: string): number {
  const cleaned = timestamp.replace(/[\[\]]/g, "").trim();
  const parts = cleaned.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return Number(cleaned) || 0;
}
