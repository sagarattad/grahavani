import { createHash, randomBytes } from "node:crypto";
import type { Birth } from "./kundlit";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** 22 base62 characters ≈ 131 bits: unguessable share-link slugs. */
export function newSlug(): string {
  const bytes = randomBytes(22);
  let s = "";
  for (const b of bytes) s += BASE62[b % 62];
  return s;
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** One cache row per distinct birth. 4 decimal places ≈ 11 m. */
export function birthKey(b: Birth): string {
  return sha256([b.birth_date, b.birth_time, b.latitude.toFixed(4), b.longitude.toFixed(4), b.timezone].join("|"));
}

/** Order matters: Groom first, Bride second. */
export const pairKey = (boyKey: string, girlKey: string) => sha256(`${boyKey}|${girlKey}`);

export const hashIp = (ip: string) => sha256(`${ip}|${process.env.IP_HASH_SALT ?? ""}`);

/** Deterministic JSON (sorted keys) so equal facts always hash the same. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}
