import { describe, expect, it } from "vitest";
import { parseYouTubeVideoId } from "./youtube";

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
