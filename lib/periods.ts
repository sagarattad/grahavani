import { graha } from "./glossary";
import { dateOnly } from "./format";
import type { Window } from "./dasha";

/** "Rahu – Shukra Antardasha · 25 Jan 2026 – 25 Jan 2029 (running now)" — dates in IST. */
export function windowText(w: Window): string {
  const name = w.ad ? `${graha(w.md)} – ${graha(w.ad)} Antardasha` : `${graha(w.md)} Mahadasha`;
  return `${name} · ${dateOnly(w.start)} – ${dateOnly(w.end)}${w.current ? " (running now)" : ""}`;
}
