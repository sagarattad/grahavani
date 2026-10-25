import { graha } from "./glossary";
import { dateOnly } from "./format";
import type { Window } from "./dasha";

/** "Rahu – Shukra Antardasha · 25 Jan 2026 – 25 Jan 2029 (running now)" — dates in IST. */
export function windowText(w: Window): string {
  const name = w.ad ? `${graha(w.md)} – ${graha(w.ad)} Antardasha` : `${graha(w.md)} Mahadasha`;
  return `${name} · ${dateOnly(w.start)} – ${dateOnly(w.end)}${w.current ? " (running now)" : ""}`;
}

/** Activation windows listed on the page and PDF before "and N more" (the AI gets them all). */
export const WINDOWS_SHOWN = 8;

/** "a; b; c" for at most WINDOWS_SHOWN windows, then "; and N more". */
export function windowsText(ws: Window[]): string {
  const more = ws.length - WINDOWS_SHOWN;
  return ws.slice(0, WINDOWS_SHOWN).map(windowText).join("; ") + (more > 0 ? `; and ${more} more` : "");
}
