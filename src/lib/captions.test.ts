import { describe, expect, it } from "vitest";
import { cleanCaption } from "./captions";

describe("cleanCaption", () => {
  it.each([
    ["- All right, so this is the Humane AI Pin.", "All right, so this is the Humane AI Pin."],
    ["for this? - Yeah. I think so - [Andrej] Right.", "for this? — Yeah. I think so — [Andrej] Right."],
    ["The construction was completed by- - Okay. So", "The construction was completed by — Okay. So"],
    ["- -", ""],
    ["well-known self-driving car", "well-known self-driving car"],
    ["0-60 in 1.9 seconds", "0-60 in 1.9 seconds"],
    ["  extra   spaces  ", "extra spaces"],
  ])("%j -> %j", (input, expected) => {
    expect(cleanCaption(input)).toBe(expected);
  });
});
