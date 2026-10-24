// The ONLY file that talks to Kundlit (https://kundlit.com/api/astro).
// Swap this file to change the calculation provider.
import "server-only";
import type { z } from "zod";
import { takeSlot, getCooldown, setCooldown, countKundlitCall } from "./rateLimit";
import {
  janamKundaliResponse,
  dashaResponse,
  manglikResponse,
  milanResponse,
  kaalSarpResponse,
  type Chart,
  type DashaCurrent,
  type Manglik,
  type Milan,
  type KaalSarp,
  type Attribution,
} from "./kundlit-schemas";

const BASE = "https://kundlit.com/api/astro";
const TIMEOUT_MS = 15_000;

// Our own limits per 10-second window. Any 60 s spans at most 7 windows, so
// 2/window ≤ 14/min (70% of janam-kundali's 20/min) and 3/window ≤ 21/min
// (70% of the other endpoints' 30/min), even when bursts straddle windows.
const WINDOW_SECONDS = 10;
const PER_WINDOW: Record<Endpoint, number> = {
  "janam-kundali": 2,
  dasha: 3,
  manglik: 3,
  "kundli-milan": 3,
  "kaal-sarp": 3,
};
const MAX_WAIT_SECONDS = 10;

type Endpoint = "janam-kundali" | "dasha" | "manglik" | "kundli-milan" | "kaal-sarp";

export type Birth = {
  birth_date: string; // YYYY-MM-DD
  birth_time: string; // HH:MM
  latitude: number;
  longitude: number;
  timezone: string;
};

export class KundlitError extends Error {
  constructor(
    public code: "busy" | "unavailable" | "invalid" | "schema",
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const skipLimiter = () => process.env.KUNDLIT_SKIP_LIMITER === "1";

async function waitForSlot(endpoint: Endpoint) {
  if (skipLimiter()) return;
  const blockedFor = await getCooldown(endpoint);
  if (blockedFor > MAX_WAIT_SECONDS) {
    throw new KundlitError("busy", "Kundlit asked us to slow down", blockedFor);
  }
  if (blockedFor > 0) await sleep(blockedFor);

  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = await takeSlot(`kundlit:${endpoint}`, PER_WINDOW[endpoint], WINDOW_SECONDS);
    if (wait === 0) return;
    await sleep(wait);
  }
  throw new KundlitError("busy", "Too many calculations right now", 20);
}

async function post<S extends z.ZodTypeAny>(endpoint: Endpoint, body: unknown, schema: S): Promise<z.infer<S>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await waitForSlot(endpoint);
    let res: Response;
    try {
      res = await fetch(`${BASE}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      if (attempt === 0) {
        await sleep(2);
        continue;
      }
      throw new KundlitError("unavailable", "Kundlit did not respond");
    }
    if (!skipLimiter()) await countKundlitCall();

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 60;
      if (!skipLimiter()) await setCooldown(endpoint, retryAfter);
      if (attempt === 0 && retryAfter <= MAX_WAIT_SECONDS) continue; // waitForSlot sleeps it off
      throw new KundlitError("busy", "Kundlit rate limit reached", retryAfter);
    }
    if (res.status === 502 || res.status === 503) {
      if (attempt === 0) {
        await sleep(2);
        continue;
      }
      throw new KundlitError("unavailable", `Kundlit returned ${res.status}`);
    }
    if (!res.ok) {
      const text = await res.text();
      throw new KundlitError("invalid", `Kundlit ${endpoint} ${res.status}: ${text.slice(0, 300)}`);
    }

    const parsed = schema.safeParse(await res.json());
    if (!parsed.success) {
      console.error("kundlit_schema_drift", endpoint, JSON.stringify(parsed.error.issues).slice(0, 2000));
      throw new KundlitError("schema", "Unexpected response from Kundlit");
    }
    return parsed.data;
  }
  throw new KundlitError("unavailable", "Kundlit unavailable");
}

const birthBody = (b: Birth) => ({
  birth_date: b.birth_date,
  birth_time: b.birth_time,
  latitude: b.latitude,
  longitude: b.longitude,
  timezone: b.timezone,
});

export async function getKundli(b: Birth): Promise<{ chart: Chart; attribution: Attribution }> {
  return post("janam-kundali", birthBody(b), janamKundaliResponse);
}

export async function getCurrentDasha(b: Birth): Promise<DashaCurrent> {
  const r = await post("dasha", birthBody(b), dashaResponse);
  return r.result.current;
}

export async function getManglik(b: Birth): Promise<{ result: Manglik; attribution: Attribution }> {
  const { attribution, ...result } = await post("manglik", birthBody(b), manglikResponse);
  return { result, attribution };
}

export async function getKaalSarp(b: Birth): Promise<{ result: KaalSarp; attribution: Attribution }> {
  const { attribution, ...result } = await post("kaal-sarp", birthBody(b), kaalSarpResponse);
  return { result, attribution };
}

export async function getMilan(boy: Birth, girl: Birth): Promise<{ result: Milan; attribution: Attribution }> {
  const { attribution, ...result } = await post(
    "kundli-milan",
    { person_a: { ...birthBody(boy), gender: "male" }, person_b: { ...birthBody(girl), gender: "female" } },
    milanResponse,
  );
  return { result, attribution };
}
