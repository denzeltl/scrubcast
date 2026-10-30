/**
 * Transforms raw API errors (such as JSON dumps from Groq, Gemini, or YouTube)
 * into clean, user-friendly messages.
 */
export function formatFriendlyErrorMessage(raw: string): string {
  if (!raw) return "An unexpected error occurred. Please try again.";

  // If the error message embeds a JSON response (e.g. 400 {"error": ...})
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const failedGen = parsed?.error?.failed_generation ?? parsed?.failed_generation;
      if (typeof failedGen === "string" && failedGen) {
        return failedGen;
      }
      const errMsg = parsed?.error?.message ?? parsed?.message;
      if (typeof errMsg === "string" && errMsg) {
        return errMsg;
      }
    }
  } catch {
    // Ignore JSON parsing issues
  }

  if (/json_validate_failed/i.test(raw) || /not enough information/i.test(raw)) {
    return "Not enough transcript content to generate structured chapters and key points.";
  }
  if (/rate_limit|429/i.test(raw)) {
    return "API rate limit reached. Please wait a moment and try again.";
  }
  if (/401|invalid_api_key/i.test(raw)) {
    return "Invalid API key configured on the server.";
  }
  if (/youtube_blocked/i.test(raw)) {
    return "YouTube blocked this public server from fetching captions. Use Watch Video (Vision) mode instead.";
  }

  // Strip leading HTTP status code like "400 " or "500 "
  const cleaned = raw.replace(/^\d{3}\s+/, "").trim();
  return cleaned.length > 200 ? `${cleaned.slice(0, 197)}...` : cleaned;
}
