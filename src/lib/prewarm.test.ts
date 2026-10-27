import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prewarmServer } from "./prewarm";

describe("prewarmServer", () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as { window?: unknown }).window;

  beforeEach(() => {
    vi.useFakeTimers();
    // Simulate browser window environment in node test runner
    (globalThis as { window?: unknown }).window = globalThis;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (globalThis as { window?: unknown }).window = originalWindow;
    vi.useRealTimers();
  });

  it("fires a fetch request to /api/health with keepalive", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    globalThis.fetch = fetchMock;

    prewarmServer();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({
        method: "GET",
        keepalive: true,
      })
    );
  });

  it("throttles subsequent pings within 60 seconds", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    globalThis.fetch = fetchMock;

    // Advance beyond any previous test run's timestamp
    vi.advanceTimersByTime(120_000);

    prewarmServer();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Immediate second call should be throttled
    prewarmServer();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // After 61 seconds, should fire again
    vi.advanceTimersByTime(61_000);
    prewarmServer();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
