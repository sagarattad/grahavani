import "server-only";
import { headers } from "next/headers";
import { hashIp } from "./ids";
import { allow } from "./rateLimit";
import { loginRequired } from "./access";

export async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return hashIp(ip);
}

/**
 * Verifies a Cloudflare Turnstile token on the server. Without a secret key the
 * check is skipped, but only in private mode (every visitor is a signed-in,
 * allowed account) or in local development; a public site must have real keys.
 */
export async function verifyTurnstile(token: string | undefined | null): Promise<boolean> {
  if (!process.env.TURNSTILE_SECRET_KEY) return loginRequired() || process.env.NODE_ENV !== "production";
  if (!token) return false;
  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY ?? "", response: token });
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

// Per-visitor caps (hashed IP) that protect the shared Kundlit quota and OpenAI budget.
export const CAPS = {
  newChart: { limit: 10, windowSeconds: 3600 },
  newMatch: { limit: 5, windowSeconds: 3600 },
  reading: { limit: 10, windowSeconds: 86400 },
  pdf: { limit: 20, windowSeconds: 3600 },
  about: { limit: 20, windowSeconds: 86400 },
} as const;

export async function withinCap(ipHash: string, cap: keyof typeof CAPS) {
  const { limit, windowSeconds } = CAPS[cap];
  return allow(`ip:${ipHash}:${cap}`, limit, windowSeconds);
}

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error, ...extra }, { status });
}
