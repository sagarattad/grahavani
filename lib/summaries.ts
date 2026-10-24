// Display rules shared by the result pages and the PDFs, so they never disagree.
import { KOOTS, cancellationLabel, severity } from "./glossary";
import type { Koot, Manglik } from "./kundlit-schemas";

export function sortKoots(koots: Koot[]): Koot[] {
  const order = new Map(KOOTS.map((k, i) => [k.api, i]));
  return [...koots].sort((a, b) => (order.get(a.koot) ?? 99) - (order.get(b.koot) ?? 99));
}

/** none = no dosha, present = dosha, cancelled = dosha with a cancellation. */
export function doshaState(k: Koot): "none" | "present" | "cancelled" {
  if (!k.dosha) return "none";
  return cancellationLabel(k.cancelled_by) ? "cancelled" : "present";
}

/** "What was compared", without the koot name prefix and the "(1.0/6)" suffix. */
export const comparedText = (k: Koot) =>
  k.compared?.replace(/^[^:]+:\s*/, "").replace(/\s*\([\d.]+\/\d+\)\.?$/, "") ?? null;

export function manglikStatus(m: Manglik) {
  return m.manglik ? `Manglik: Yes — ${severity(m.severity)}` : "Manglik: No";
}

/** One-line summary of the two Manglik results (display only, no calculation). */
export function manglikCombined(groom?: Manglik | null, bride?: Manglik | null) {
  if (groom?.manglik && bride?.manglik) return "Both are Manglik — traditionally this is considered balancing.";
  if (groom?.manglik || bride?.manglik)
    return `Only the ${groom?.manglik ? "Groom" : "Bride"} is Manglik — see the cancellations; families traditionally consult further.`;
  return "Neither is Manglik.";
}

export const MANGLIK_CHECKS = [
  { key: "ascendant_check", label: "From Lagna" },
  { key: "moon_check", label: "From Chandra (Moon)" },
  { key: "venus_check", label: "From Shukra (Venus)" },
] as const;
