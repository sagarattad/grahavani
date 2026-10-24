import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rawFixture } from "../tests/fixtures";

// The limiter's database calls are replaced with in-memory fakes.
const cooldowns = new Map<string, number>();
vi.mock("./rateLimit", () => ({
  takeSlot: vi.fn(async () => 0),
  countKundlitCall: vi.fn(async () => {}),
  getCooldown: vi.fn(async (ep: string) => Math.max(0, Math.ceil(((cooldowns.get(ep) ?? 0) - Date.now()) / 1000))),
  setCooldown: vi.fn(async (ep: string, s: number) => void cooldowns.set(ep, Date.now() + s * 1000)),
}));

const { getKundli, getManglik, KundlitError } = await import("./kundlit");
const rateLimit = await import("./rateLimit");

const birth = { birth_date: "1990-01-15", birth_time: "14:30", latitude: 21.25, longitude: 81.63, timezone: "Asia/Kolkata" };
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

beforeEach(() => cooldowns.clear());
afterEach(() => vi.unstubAllGlobals());

describe("Kundlit client", () => {
  it("parses and strips a janam-kundali response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(rawFixture("janam-kundali-1990-01-15-raipur.json"))));
    const { chart, attribution } = await getKundli(birth);
    expect(chart.lagna.sign).toBe("Vrishabha");
    expect(JSON.stringify(chart)).not.toContain("citations");
    expect(attribution.source).toBe("kundlit.com");
  });

  it("on 429 stores the Retry-After cooldown and stops calling", async () => {
    const fetchMock = vi.fn(async () => json({ error: "rate_limited" }, 429, { "Retry-After": "30" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getManglik(birth)).rejects.toMatchObject({ code: "busy", retryAfter: 30 });
    expect(rateLimit.setCooldown).toHaveBeenCalledWith("manglik", 30);

    // While the cooldown runs, no request reaches Kundlit.
    fetchMock.mockClear();
    await expect(getManglik(birth)).rejects.toBeInstanceOf(KundlitError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries once on 503, then succeeds", async () => {
    const ok = rawFixture("manglik-1990-01-15-raipur.json");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: "astro_unavailable" }, 503))
      .mockResolvedValueOnce(json(ok));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = await getManglik(birth);
    expect(result.manglik).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10_000);

  it("reports schema drift instead of storing bad data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ unexpected: true })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getManglik(birth)).rejects.toMatchObject({ code: "schema" });
  });
});
