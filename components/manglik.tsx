import { MANGLIK_WEIGHTS_NOTE } from "@/lib/astro/manglik";
import { Chip } from "./ui";
import { ord } from "@/lib/astro/rules";
import type { ManglikResult } from "@/lib/astro/manglik";

/** Mars counted from Lagna, Moon and Venus, with which house set applies. */
export function ManglikChecks({ m }: { m: ManglikResult }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-3">
      {m.grahavani.refs.map((r) => (
        <li key={r.from} className="rounded-xl bg-background px-3 py-2 text-sm">
          <span className="flex items-center justify-between gap-2">
            From {r.from}
            {r.north ? <Chip tone="warn">✓ yes</Chip> : r.southOnly ? <Chip tone="muted">South Indian only</Chip> : <Chip tone="good">✗ no</Chip>}
          </span>
          <span className="block text-xs text-muted">Mars in the {ord(r.house)}</span>
        </li>
      ))}
    </ul>
  );
}

export function ManglikDetails({ m }: { m: ManglikResult }) {
  const g = m.grahavani;
  const applying = g.cancellations.filter((c) => c.applies);
  const notApplying = g.cancellations.filter((c) => !c.applies && c.weight > 0);
  return (
    <>
      <h3 className="mb-2 mt-4 text-sm font-bold">Checks</h3>
      <ManglikChecks m={m} />
      <p className="mt-2 text-xs text-muted">
        Houses counted: North Indian set 1, 4, 7, 8, 12 (decides the status). The South Indian rule also counts the 2nd and is shown separately.
      </p>
      {g.intensity !== "none" && (
        <>
          <h3 className="mb-2 mt-4 text-sm font-bold">Cancellations (tradition-dependent)</h3>
          {applying.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {applying.map((c) => (
                <li key={c.text}>
                  <span className="font-semibold">Applies:</span> {c.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">None of the common cancellations apply.</p>
          )}
          {notApplying.length > 0 && <p className="mt-1 text-xs text-muted">Not applying: {notApplying.map((c) => c.text).join("; ")}.</p>}
          {g.cancellations
            .filter((c) => c.note)
            .map((c) => (
              <p key={c.text} className="mt-1 text-xs text-muted">
                {c.text}: {c.note}.
              </p>
            ))}
          <h3 className="mb-2 mt-4 text-sm font-bold">How the intensity is worked out</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {g.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">{MANGLIK_WEIGHTS_NOTE}</p>
        </>
      )}
    </>
  );
}
