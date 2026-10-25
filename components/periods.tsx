import { WINDOWS_SHOWN, windowText } from "@/lib/periods";
import type { Window } from "@/lib/dasha";

/** One line per activation window, up to WINDOWS_SHOWN, then "and N more". Dates in IST. */
export function WindowList({ windows, empty }: { windows: Window[]; empty: string }) {
  if (!windows.length) return <span className="text-muted">{empty}</span>;
  const more = windows.length - WINDOWS_SHOWN;
  return (
    <ul className="mt-1 space-y-0.5">
      {windows.slice(0, WINDOWS_SHOWN).map((w) => (
        <li key={`${w.md}-${w.ad ?? ""}-${w.start}`} className={w.current ? "font-semibold text-good" : ""}>
          {windowText(w)}
        </li>
      ))}
      {more > 0 && <li className="text-muted">and {more} more</li>}
    </ul>
  );
}
