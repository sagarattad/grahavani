import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "./request";

afterEach(() => vi.unstubAllEnvs());

describe("Turnstile without keys", () => {
  it("is skipped in private mode", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("ALLOWED_EMAILS", "me@gmail.com");
    vi.stubEnv("NODE_ENV", "production");
    expect(await verifyTurnstile(null)).toBe(true);
  });

  it("is required on a public production site", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("ALLOWED_EMAILS", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(await verifyTurnstile("turnstile-off")).toBe(false);
  });

  it("is skipped in local development", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("ALLOWED_EMAILS", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(await verifyTurnstile(null)).toBe(true);
  });

  it("still needs a token when a secret key is set", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubEnv("ALLOWED_EMAILS", "me@gmail.com");
    expect(await verifyTurnstile(null)).toBe(false);
  });
});
