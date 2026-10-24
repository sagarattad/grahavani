import { Chip } from "./ui";
import { MANGLIK_CHECKS as CHECKS } from "@/lib/summaries";
import type { Manglik } from "@/lib/kundlit-schemas";

export function ManglikChecks({ m }: { m: Manglik }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-3">
      {CHECKS.map((c) => (
        <li key={c.key} className="flex items-center justify-between rounded-xl bg-background px-3 py-2 text-sm">
          {c.label}
          {m[c.key] ? <Chip tone="warn">✓ triggered</Chip> : <Chip tone="good">✗ no</Chip>}
        </li>
      ))}
    </ul>
  );
}

export function ManglikDetails({ m }: { m: Manglik }) {
  return (
    <>
      <h3 className="mb-2 mt-4 text-sm font-bold">Checks</h3>
      <ManglikChecks m={m} />
      <h3 className="mb-2 mt-4 text-sm font-bold">Cancellations</h3>
      {m.cancellations.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {m.cancellations.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">None reported.</p>
      )}
    </>
  );
}
