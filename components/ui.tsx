import type { ReactNode } from "react";
import { TERMS, type TermId } from "@/lib/glossary";
import type { Attribution as AttributionData } from "@/lib/kundlit-schemas";

/** A glossary term. `full` adds the English meaning — use it on first use on a page. */
export function Term({ id, full = false }: { id: TermId; full?: boolean }) {
  const t = TERMS[id];
  return (
    <>
      {t.en}
      {full && <span className="font-normal text-muted"> ({t.meaning})</span>}
    </>
  );
}

export function Section({ title, children, id }: { title: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="card mb-4">
      <h2 className="h2">{title}</h2>
      {children}
    </section>
  );
}

export function Attribution({ data }: { data: AttributionData }) {
  return (
    <p className="mt-3 text-xs text-muted">
      {data.citation.replace(/ Please credit.*$/, "")}{" "}
      <a href={data.url} target="_blank" rel="noopener noreferrer" className="underline">
        kundlit.com
      </a>
    </p>
  );
}

export function Note({ tone = "warn", title, children }: { tone?: "warn" | "good" | "bad"; title?: ReactNode; children: ReactNode }) {
  const cls = {
    warn: "border-warn/40 bg-warn-bg text-warn",
    good: "border-good/40 bg-good-bg text-good",
    bad: "border-bad/40 bg-bad-bg text-bad",
  }[tone];
  return (
    <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${cls}`} role="note">
      {title && <p className="font-bold">{title}</p>}
      <div className="text-foreground/90">{children}</div>
    </div>
  );
}

export function Chip({ tone, children }: { tone: "good" | "warn" | "bad" | "muted"; children: ReactNode }) {
  const cls = {
    good: "bg-good-bg text-good",
    warn: "bg-warn-bg text-warn",
    bad: "bg-bad-bg text-bad",
    muted: "bg-background text-muted",
  }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export function Skeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true">
      <div className="h-8 w-2/3 rounded-lg bg-border" />
      <div className="h-64 rounded-2xl bg-border/60" />
      <div className="h-40 rounded-2xl bg-border/60" />
    </div>
  );
}
