import { describe, expect, it } from "vitest";
import { formatFriendlyErrorMessage } from "./errorUtils";

describe("formatFriendlyErrorMessage", () => {
  it("extracts failed_generation from JSON error response (from user screenshot)", () => {
    const raw =
      '400 {"error":{"message":"Failed to generate JSON. Please adjust your prompt. See \'failed_generation\' for more details.","type":"invalid_request_error","code":"json_validate_failed","failed_generation":"I\'m sorry, but I don\'t have enough information to create the requested JSON. I would need the actual transcript text with timestamps to identify chapter breaks and notable claims."}}';
    const result = formatFriendlyErrorMessage(raw);
    expect(result).toBe(
      "I'm sorry, but I don't have enough information to create the requested JSON. I would need the actual transcript text with timestamps to identify chapter breaks and notable claims."
    );
  });

  it("extracts error.message when failed_generation is absent", () => {
    const raw = '400 {"error":{"message":"Model decommissioned or unavailable."}}';
    expect(formatFriendlyErrorMessage(raw)).toBe("Model decommissioned or unavailable.");
  });

  it("handles rate limit strings", () => {
    const raw = "Rate limit reached: 429 Too Many Requests";
    expect(formatFriendlyErrorMessage(raw)).toContain("rate limit reached");
  });

  it("strips HTTP status codes from plain text errors", () => {
    const raw = "500 Something went wrong on the server";
    expect(formatFriendlyErrorMessage(raw)).toBe("Something went wrong on the server");
  });

  it("provides a default message when string is empty", () => {
    expect(formatFriendlyErrorMessage("")).toBe("An unexpected error occurred. Please try again.");
  });
});
