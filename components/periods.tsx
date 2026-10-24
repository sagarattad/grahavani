import { windowText } from "@/lib/periods";
import type { Window } from "@/lib/dasha";

/** One line per activation window. Dates in IST. */
export function WindowList({ windows, empty }: { windows: Window[]; empty: string }) {
  if (!windows.length) return <span className="text-muted">{empty}</span>;
  return (
    <ul className="mt-1 space-y-0.5">
      {windows.map((w) => (
        <li key={`${w.md}-${w.ad ?? ""}-${w.start}`} className={w.current ? "font-semibold text-good" : ""}>
          {windowText(w)}
        </li>
      ))}
    </ul>
  );
}
