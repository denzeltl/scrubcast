import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Groq from "groq-sdk";

// groqKeys builds its key slots from the environment when first imported
let mod: typeof import("./groqKeys");
type Slot = { label: string; disabled: boolean; coolingUntil: number; client: { chat: { completions: { create: unknown } } } };
let slots: Slot[];

const ok = { choices: [{ message: { content: "ok" } }] };
const params = { model: "m", messages: [{ role: "user" as const, content: "hi" }] };
const apiError = (status: number, headers: Record<string, string> = {}) =>
  Groq.APIError.generate(status, {}, "err", new Headers(headers));

beforeAll(async () => {
  process.env.GROQ_API_KEY = "gsk_primary_test";
  process.env.GROQ_API_KEY_BACKUP = "gsk_backup_test";
  mod = await import("./groqKeys");
  slots = (globalThis as unknown as { __scrubcastGroqKeys: Slot[] }).__scrubcastGroqKeys;
});

beforeEach(() => {
  for (const s of slots) Object.assign(s, { disabled: false, coolingUntil: 0 });
});

const stub = (label: string, impl: () => unknown) => {
  const fn = vi.fn(impl);
  slots.find((s) => s.label === label)!.client.chat.completions.create = fn;
  return fn;
};

describe("createChatCompletion failover", () => {
  it("uses the primary key when it works", async () => {
    const primary = stub("primary", async () => ok);
    const backup = stub("backup", async () => ok);
    await mod.createChatCompletion(params);
    expect(primary).toHaveBeenCalledTimes(1);
    expect(backup).not.toHaveBeenCalled();
  });

  it("switches to the backup when the primary key is rejected, and stops trying the primary", async () => {
    const primary = stub("primary", async () => { throw apiError(401); });
    stub("backup", async () => ok);
    await expect(mod.createChatCompletion(params)).resolves.toEqual(ok);
    await mod.createChatCompletion(params);
    expect(primary).toHaveBeenCalledTimes(1);
  });

  it("switches to the backup when the primary is rate-limited", async () => {
    stub("primary", async () => { throw apiError(429, { "retry-after": "30" }); });
    const backup = stub("backup", async () => ok);
    await expect(mod.createChatCompletion(params)).resolves.toEqual(ok);
    expect(backup).toHaveBeenCalledTimes(1);
  });

  it("gives up with the 429 when every key is limited longer than the caller will wait", async () => {
    stub("primary", async () => { throw apiError(429, { "retry-after": "30" }); });
    stub("backup", async () => { throw apiError(429, { "retry-after": "30" }); });
    await expect(mod.createChatCompletion(params, { maxWaitMs: 50 })).rejects.toMatchObject({ status: 429 });
  });

  it("doesn't retry errors another key can't fix", async () => {
    stub("primary", async () => { throw apiError(400); });
    const backup = stub("backup", async () => ok);
    await expect(mod.createChatCompletion(params)).rejects.toMatchObject({ status: 400 });
    expect(backup).not.toHaveBeenCalled();
  });
});
