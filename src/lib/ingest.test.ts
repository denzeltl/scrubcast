import { describe, expect, it } from "vitest";
import { chunkSegments } from "./ingest";
import type { CaptionSegment } from "./youtube";

// 3-second caption lines, like YouTube's
const lines = (count: number, text = (i: number) => `line ${i}`): CaptionSegment[] =>
  Array.from({ length: count }, (_, i) => ({ start: i * 3, duration: 3.5, text: text(i) }));

describe("chunkSegments", () => {
  it("groups short caption lines into passages of at most 45 seconds", () => {
    const chunks = chunkSegments("yt-x", lines(60)); // 3 minutes
    expect(chunks.length).toBeGreaterThanOrEqual(4);
    for (const c of chunks) expect(c.endTime - c.startTime).toBeLessThanOrEqual(45);
  });

  it("prefers to break at a sentence end once 30 seconds have passed", () => {
    const chunks = chunkSegments("yt-x", lines(30, (i) => (i === 11 ? "end of thought." : `word ${i}`)));
    // line 11 starts at 33s and ends a sentence, so the next passage starts at line 12 (36s)
    expect(chunks[1].startTime).toBe(36);
  });

  it("keeps passages contiguous: each ends just before the next begins", () => {
    const chunks = chunkSegments("yt-x", lines(60));
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i - 1].endTime).toBeLessThan(chunks[i].startTime);
      expect(chunks[i].startTime - chunks[i - 1].endTime).toBeLessThanOrEqual(1);
    }
  });

  it("gives stable ids, the episode id, and joins the text", () => {
    const chunks = chunkSegments("yt-abc", lines(3));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ id: "yt-abc-chunk-1", episodeId: "yt-abc", startTime: 0, speaker: "Speaker" });
    expect(chunks[0].text).toBe("line 0 line 1 line 2");
  });

  it("handles no captions", () => {
    expect(chunkSegments("yt-x", [])).toEqual([]);
  });

  it("never gives a passage an end before its start (one very short line)", () => {
    const [c] = chunkSegments("yt-x", [{ start: 10.2, duration: 0.1, text: "hi" }]);
    expect(c.endTime).toBeGreaterThanOrEqual(c.startTime);
  });
});
