import { describe, expect, it } from "vitest";
import { formatTimestamp, parseTimestampToSeconds } from "./time";

describe("formatTimestamp", () => {
  it.each([
    [0, "00:00"],
    [64.9, "01:04"],
    [3599, "59:59"],
    [3600, "01:00:00"],
    [5802, "01:36:42"],
    [-5, "00:00"],
  ])("%d -> %s", (seconds, expected) => {
    expect(formatTimestamp(seconds)).toBe(expected);
  });
});

describe("parseTimestampToSeconds", () => {
  it.each([
    ["01:04", 64],
    ["[01:04]", 64],
    ["01:36:42", 5802],
    ["90", 90],
    ["nonsense", 0],
  ])("%s -> %d", (stamp, expected) => {
    expect(parseTimestampToSeconds(stamp)).toBe(expected);
  });

  it("round-trips with formatTimestamp", () => {
    for (const s of [0, 59, 61, 3599, 3600, 7322]) expect(parseTimestampToSeconds(formatTimestamp(s))).toBe(s);
  });
});
