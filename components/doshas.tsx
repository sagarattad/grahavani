import Link from "next/link";
import { Chip, Section, Term } from "./ui";
import { WindowList } from "./periods";
import { RetryButton } from "./RetryButton";
import { AboutToggle } from "./About";
import { RatingLine } from "./rating";
import { RATING_NOTE } from "@/lib/strength";
import { loadDoshaData } from "@/lib/cache";
import { ABOUT_DOSHA_STATUSES } from "@/lib/ai/about";
import { buildDoshas, rangeText, type DoshaCard } from "@/lib/doshas";
import { dateOnly } from "@/lib/format";
import type { BirthChart } from "@/lib/generated/prisma/client";

const TONE: Record<DoshaCard["status"], "good" | "warn" | "bad" | "muted"> = {
  present: "bad",
  running: "bad",
  cancelled: "warn",
  upcoming: "warn",
  absent: "good",
  none: "good",
  unavailable: "muted",
};

export function DoshaCards({ cards }: { cards: DoshaCard[] }) {
  return (
    <ul className="space-y-3">
      {cards.map((c) => (
        <li key={c.key} className="rounded-xl border border-border p-3 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{c.name}</span>
            <Chip tone={TONE[c.status]}>{c.statusLabel}</Chip>
          </p>
          {c.meaning && <p className="mt-0.5 text-xs text-muted">{c.meaning}</p>}
          {c.status === "unavailable" ? (
            <p className="mt-2 text-xs text-muted">
              Could not load this right now. <RetryButton />
            </p>
          ) : (
            <>
              {c.details.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {c.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
              {c.windows.length > 0 && (
                <div className="mt-2 text-xs">
                  <span className="font-semibold">Traditionally felt in: </span>
                  <WindowList windows={c.windows} empty="" />
                </div>
              )}
              {c.ranges.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs">
                  {c.ranges.map((r) => (
                    <li key={r.label + r.start} className={r.current ? "font-semibold text-bad" : ""}>
                      {rangeText(r)}
                      {r.current && " (running now)"}
                    </li>
                  ))}
                </ul>
              )}
              {c.ranges.length > 0 && (
                <p className="mt-1 text-xs text-muted">
                  Saturn&apos;s sign changes computed by Grahavani (Lahiri), including retrograde returns, over the current and next Mahadasha.
                </p>
              )}
              {c.rating.level && <RatingLine rating={c.rating} kind="dosha" />}
              {ABOUT_DOSHA_STATUSES.has(c.status) && <AboutToggle itemKey={c.key} label="About this Dosha" />}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Loads Manglik / Kaal Sarp / transit data lazily (inside <Suspense>) and shows the cards. */
export async function DoshasLoader({ chartRow, title }: { chartRow: BirthChart; title?: React.ReactNode }) {
  const data = await loadDoshaData(chartRow);
  const cards = buildDoshas({ ...data, asOf: data.chart.vimshottari.current.as_of });
  return (
    <Section title={title ?? <Term id="dosha" full />}>
      <DoshaCards cards={cards} />
      <p className="mt-3 text-xs text-muted">
        Doshas are traditional indications, not predictions. Cancellations listed by Kundlit are shown with each one.
      </p>
      <p className="mt-1 text-xs text-muted">{RATING_NOTE}</p>
    </Section>
  );
}

export function DoshasSkeleton({ label = "Checking Doshas…" }: { label?: string }) {
  return (
    <section className="card mb-4 animate-pulse" aria-busy="true">
      <p className="text-sm text-muted">{label}</p>
      <div className="mt-3 h-24 rounded-xl bg-border/60" />
    </section>
  );
}

export function KundliLink({ slug, label }: { slug: string; label: string }) {
  return (
    <Link href={`/kundli/${slug}`} className="text-sm font-semibold text-brand underline">
      {label}
    </Link>
  );
}
