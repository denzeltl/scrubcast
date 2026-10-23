import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { checkRateLimit } from "./rateLimit";

const req = (headers: Record<string, string>) => new NextRequest("http://localhost/api/search", { headers });

describe("checkRateLimit", () => {
  it("allows up to the limit, then answers 429 with Retry-After", async () => {
    const limit = { name: "t-basic", max: 2, windowMs: 60_000 };
    const r = req({ "x-forwarded-for": "203.0.113.1" });
    expect(checkRateLimit(r, limit)).toBeNull();
    expect(checkRateLimit(r, limit)).toBeNull();
    const blocked = checkRateLimit(r, limit);
    expect(blocked?.status).toBe(429);
    expect(Number(blocked?.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await blocked!.json()).error).toMatch(/limit of 2/);
  });

  it("counts visitors separately", () => {
    const limit = { name: "t-separate", max: 1, windowMs: 60_000 };
    expect(checkRateLimit(req({ "x-forwarded-for": "203.0.113.2" }), limit)).toBeNull();
    expect(checkRateLimit(req({ "x-forwarded-for": "203.0.113.3" }), limit)).toBeNull();
  });

  it("uses the address the proxy appended, so a forged first entry doesn't dodge the limit", () => {
    const limit = { name: "t-spoof", max: 1, windowMs: 60_000 };
    // The visitor sends a fake X-Forwarded-For each time; the host's proxy appends the real IP
    expect(checkRateLimit(req({ "x-forwarded-for": "1.1.1.1, 198.51.100.7" }), limit)).toBeNull();
    expect(checkRateLimit(req({ "x-forwarded-for": "2.2.2.2, 198.51.100.7" }), limit)?.status).toBe(429);
  });

  it("falls back to x-real-ip", () => {
    const limit = { name: "t-realip", max: 1, windowMs: 60_000 };
    expect(checkRateLimit(req({ "x-real-ip": "198.51.100.9" }), limit)).toBeNull();
    expect(checkRateLimit(req({ "x-real-ip": "198.51.100.9" }), limit)?.status).toBe(429);
  });
});
