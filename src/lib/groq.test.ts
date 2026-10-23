import { describe, expect, it } from "vitest";
import { extractCitationsFromText, snapCitationsToSources } from "./groq";
import type { SearchMatch } from "@/types/podcast";

const match = (start: number, end: number, speaker = "Speaker"): SearchMatch => ({
  score: 0.8,
  chunk: { id: `c-${start}`, episodeId: "e", startTime: start, endTime: end, speaker, text: `passage at ${start}` },
});

// 1:36:42-1:37:10, 46:20-46:50, 1:04-1:34
const matches = [match(5802, 5830), match(2780, 2810), match(64, 94)];

describe("snapCitationsToSources", () => {
  it("keeps a timestamp that falls inside a passage, written as its start", () => {
    expect(snapCitationsToSources("see [46:30]", matches)).toBe("see [46:20]");
    expect(snapCitationsToSources("see [01:04]", matches)).toBe("see [01:04]");
  });

  it("reads a truncated HH:MM as hours when that lands on a passage", () => {
    // the model wrote [01:36] for 1:36:42; read as 1m36s it would seek to the wrong place
    expect(snapCitationsToSources("at [01:36]", matches)).toBe("at [01:36:42]");
  });

  it("turns full-width brackets into normal chips", () => {
    expect(snapCitationsToSources("x 【01:36:42】 y 【 46:20 】", matches)).toBe("x [01:36:42] y [46:20]");
  });

  it("snaps an invented time to the nearest passage", () => {
    expect(snapCitationsToSources("[99:99]", matches)).toBe("[01:36:42]");
  });

  it("leaves text without timestamps alone, and copes with no passages", () => {
    expect(snapCitationsToSources("no citations here", matches)).toBe("no citations here");
    expect(snapCitationsToSources("at [01:00]", [])).toBe("at [01:00]");
  });
});

describe("extractCitationsFromText", () => {
  it("lists each cited timestamp once, with its passage", () => {
    const citations = extractCitationsFromText("a [46:20] b [46:20] c [01:04]", matches);
    expect(citations.map((c) => c.timestamp)).toEqual(["46:20", "01:04"]);
    expect(citations[0]).toMatchObject({ seconds: 2780, chunkId: "c-2780" });
  });

  it("falls back to the top passages when the answer cites nothing", () => {
    const citations = extractCitationsFromText("an answer with no chips", matches);
    expect(citations).toHaveLength(3);
    expect(citations[0].seconds).toBe(5802);
  });
});
