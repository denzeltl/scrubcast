import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchYouTubeOEmbed, fetchYouTubeVideo, parseYouTubeVideoId, YouTubeBlockedError } from "./youtube";

describe("parseYouTubeVideoId", () => {
  const id = "scwlR0QHGOk";

  it.each([
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=42s&list=PL123`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://music.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?si=abc`,
    `youtu.be/${id}`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `  ${id}  `,
  ])("reads %s", (url) => {
    expect(parseYouTubeVideoId(url)).toBe(id);
  });

  it.each([
    "",
    "not a link",
    "https://vimeo.com/12345",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ",
    "https://evil.com/watch?v=scwlR0QHGOk",
    "https://youtube.com.evil.com/watch?v=scwlR0QHGOk",
    "javascript:alert(1)",
  ])("rejects %j", (url) => {
    expect(parseYouTubeVideoId(url)).toBeNull();
  });
});

describe("fetchYouTubeVideo", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("flags a 403 as YouTube blocking the server", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 403 })));
    await expect(fetchYouTubeVideo("dQw4w9WgXcQ")).rejects.toBeInstanceOf(YouTubeBlockedError);
  });

  it("flags a bot check as YouTube blocking the server", async () => {
    const body = { playabilityStatus: { status: "LOGIN_REQUIRED", reason: "Sign in to confirm you're not a bot" } };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(body)));
    await expect(fetchYouTubeVideo("dQw4w9WgXcQ")).rejects.toBeInstanceOf(YouTubeBlockedError);
  });

  it("treats a private video as a video problem, not a block", async () => {
    const body = { playabilityStatus: { status: "LOGIN_REQUIRED", reason: "This video is private" } };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(body)));
    const err = await fetchYouTubeVideo("dQw4w9WgXcQ").catch((e) => e);
    expect(err).not.toBeInstanceOf(YouTubeBlockedError);
    expect(err.message).toMatch(/private/);
  });
});

describe("fetchYouTubeOEmbed", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses oEmbed JSON when successful", async () => {
    const mockData = {
      title: "Test Video Title",
      author_name: "Test Author",
      thumbnail_url: "https://example.com/thumb.jpg",
    };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(mockData)));

    const result = await fetchYouTubeOEmbed("dQw4w9WgXcQ");
    expect(result.title).toBe("Test Video Title");
    expect(result.author).toBe("Test Author");
    expect(result.thumbnailUrl).toBe("https://example.com/thumb.jpg");
  });

  it("returns fallback metadata when oEmbed request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));

    const result = await fetchYouTubeOEmbed("dQw4w9WgXcQ");
    expect(result.title).toContain("dQw4w9WgXcQ");
    expect(result.author).toBe("YouTube Creator");
  });
});
