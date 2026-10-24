import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchYouTubeVideo, parseYouTubeVideoId, YouTubeBlockedError } from "./youtube";

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
