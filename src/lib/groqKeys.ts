import Groq from "groq-sdk";
import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming } from "groq-sdk/resources/chat/completions";

// Primary + optional backup Groq key. Requests go to the primary; if Groq rejects it
// (401/403: revoked, expired, typo) or rate-limits it (429), the same request is
// retried on the backup instead of failing or waiting.
//
// Groq applies rate limits per organization, not per key: a backup key from the same
// org shares the primary's limits and only helps when the primary key itself is bad.

interface KeySlot {
  label: "primary" | "backup";
  client: Groq;
  disabled: boolean; // rejected by Groq; skipped until the server restarts
  coolingUntil: number; // rate-limited until this time (ms epoch)
}

// Shared across route modules and dev reloads, like the summary job state
const shared = ((globalThis as { __scrubcastGroqKeys?: KeySlot[] }).__scrubcastGroqKeys ??= buildSlots());

function buildSlots(): KeySlot[] {
  const keys: [KeySlot["label"], string | undefined][] = [
    ["primary", process.env.GROQ_API_KEY],
    ["backup", process.env.GROQ_API_KEY_BACKUP],
  ];
  return keys
    .filter((entry): entry is [KeySlot["label"], string] => Boolean(entry[1]?.trim()))
    .map(([label, apiKey]) => ({
      label,
      // Rate limits and bad keys are handled below, so the SDK shouldn't sit retrying them
      client: new Groq({ apiKey: apiKey.trim(), maxRetries: 0, timeout: 60_000 }),
      disabled: false,
      coolingUntil: 0,
    }));
}

export function hasGroqKey(): boolean {
  return shared.some((slot) => !slot.disabled);
}

/**
 * Chat completion with key failover.
 * maxWaitMs: if every key is rate-limited, how long to wait for one to free up
 * before giving up (short for live answers, long for background summaries).
 */
export async function createChatCompletion(
  params: ChatCompletionCreateParamsNonStreaming,
  { maxWaitMs = 10_000 }: { maxWaitMs?: number } = {}
): Promise<ChatCompletion> {
  const deadline = Date.now() + maxWaitMs;
  let lastError: unknown = new Error("No Groq API key is set (GROQ_API_KEY)");

  for (;;) {
    const usable = shared.filter((slot) => !slot.disabled);
    if (usable.length === 0) throw lastError;

    const ready = usable.filter((slot) => slot.coolingUntil <= Date.now());
    for (const slot of ready) {
      try {
        return await slot.client.chat.completions.create(params);
      } catch (err) {
        lastError = err;
        if (!(err instanceof Groq.APIError)) throw err;

        if (err.status === 401 || err.status === 403) {
          slot.disabled = true;
          console.warn(`Groq ${slot.label} key was rejected (${err.status}); ${nextKeyNote(slot)}`);
          continue;
        }
        if (err.status === 429) {
          slot.coolingUntil = Date.now() + retryAfterMs(err.headers);
          console.warn(`Groq ${slot.label} key is rate-limited; ${nextKeyNote(slot)}`);
          continue;
        }
        // Model not found, bad request, server errors: another key won't help
        throw err;
      }
    }

    // Every usable key is cooling down: wait for the first one, if that fits the budget
    const stillUsable = shared.filter((slot) => !slot.disabled);
    if (stillUsable.length === 0) throw lastError;
    const nextFree = Math.min(...stillUsable.map((slot) => slot.coolingUntil));
    if (nextFree > deadline) throw lastError;
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, nextFree - Date.now()) + 100));
  }
}

function nextKeyNote(slot: KeySlot): string {
  const other = shared.find((s) => s !== slot && !s.disabled);
  if (!other) return "no other key to try";
  return other.coolingUntil <= Date.now()
    ? `trying the ${other.label} key`
    : "waiting for a key to free up";
}

/**
 * Groq sends retry-after in seconds; fall back to 20s when it doesn't
 */
function retryAfterMs(headers: Headers | undefined): number {
  const seconds = Number(headers?.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 20_000;
}
