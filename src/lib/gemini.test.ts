import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { extractVisionCitations, hasGeminiKey, watchAndSynthesizeAnswer } from "./gemini";

describe("gemini module", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("extractVisionCitations", () => {
    it("extracts and formats MM:SS and HH:MM:SS timestamps", () => {
      const text =
        "At [02:15], the host holds up the new prototype. Later at [01:10:05], they show a diagram on the whiteboard.";
      const citations = extractVisionCitations(text);

      expect(citations).toHaveLength(2);
      expect(citations[0]).toMatchObject({
        timestamp: "02:15",
        seconds: 135,
        speaker: "Video Moment",
      });
      expect(citations[0].snippet).toContain("the host holds up the new prototype");

      expect(citations[1]).toMatchObject({
        timestamp: "01:10:05",
        seconds: 4205,
        speaker: "Video Moment",
      });
      expect(citations[1].snippet).toContain("show a diagram on the whiteboard");
    });

    it("deduplicates repeated timestamps and sorts them in ascending order", () => {
      const text =
        "First observation at [05:00]. An earlier point was at [01:30]. Another note at [05:00] confirms it.";
      const citations = extractVisionCitations(text);

      expect(citations).toHaveLength(2);
      expect(citations[0].timestamp).toBe("01:30");
      expect(citations[0].seconds).toBe(90);
      expect(citations[1].timestamp).toBe("05:00");
      expect(citations[1].seconds).toBe(300);
    });

    it("returns an empty array when no timestamps are present", () => {
      const citations = extractVisionCitations("This text contains no timestamps whatsoever.");
      expect(citations).toEqual([]);
    });
  });

  describe("hasGeminiKey", () => {
    it("returns false when GEMINI_API_KEY is not set or empty", () => {
      delete process.env.GEMINI_API_KEY;
      expect(hasGeminiKey()).toBe(false);

      process.env.GEMINI_API_KEY = "   ";
      expect(hasGeminiKey()).toBe(false);
    });

    it("returns true when GEMINI_API_KEY is populated", () => {
      process.env.GEMINI_API_KEY = "AIzaSyFakeKey123";
      expect(hasGeminiKey()).toBe(true);
    });
  });

  describe("watchAndSynthesizeAnswer", () => {
    it("throws an error when GEMINI_API_KEY is missing", async () => {
      delete process.env.GEMINI_API_KEY;
      await expect(watchAndSynthesizeAnswer("What color is the car?", "dQw4w9WgXcQ")).rejects.toThrow(
        /GEMINI_API_KEY is not set/
      );
    });

    it("sends youtube url in fileData and parses returned text and citations", async () => {
      process.env.GEMINI_API_KEY = "test-key";

      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "At [00:45], the presenter demonstrates the device screen in high brightness.",
                },
              ],
            },
          },
        ],
      };

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await watchAndSynthesizeAnswer("Show demo", "abc12345678");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const callArgs = fetchSpy.mock.calls[0];
      expect(callArgs[0]).toContain("key=test-key");

      const requestBody = JSON.parse(callArgs[1]?.body as string);
      expect(requestBody.contents[0].parts[0].fileData.fileUri).toBe("https://www.youtube.com/watch?v=abc12345678");

      expect(result.answer).toContain("At [00:45]");
      expect(result.citations).toHaveLength(1);
      expect(result.citations[0].timestamp).toBe("00:45");
      expect(result.citations[0].seconds).toBe(45);
    });
  });
});
