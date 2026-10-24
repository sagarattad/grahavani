import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadMatch } from "@/lib/targets";
import { chartOf, loadDoshaData } from "@/lib/cache";
import { canModify } from "@/lib/ownership";
import { auth } from "@/auth";
import { KOOTS, cancellationLabel, kootLabel, nakshatra, rashi, severity, verdict } from "@/lib/glossary";
import { nearNakshatraBoundary } from "@/lib/accuracy";
import { comparedText, doshaState, manglikCombined, sortKoots } from "@/lib/summaries";
import { birthDateTime, points } from "@/lib/format";
import { Attribution, Chip, Note, Section, Skeleton, Term } from "@/components/ui";
import { PlaceEdit } from "@/components/PlaceEdit";
import { ManglikChecks } from "@/components/manglik";
import { ReadingPanel } from "@/components/ReadingPanel";
import { DoshaCards, DoshasSkeleton, KundliLink } from "@/components/doshas";
import { RetryButton } from "@/components/RetryButton";
import { AboutProvider, AboutToggle } from "@/components/About";
import { buildDoshas } from "@/lib/doshas";
import { RatingLine } from "@/components/rating";
import { PARTIAL_POINTS_NOTE, rateKootDosha } from "@/lib/strength";
import { FollowupBox } from "@/components/FollowupBox";
import { ItemActions } from "@/components/ItemActions";
import type { Attribution as AttributionData, Koot, Milan } from "@/lib/kundlit-schemas";

export const metadata: Metadata = { title: "Gun Milan", robots: { index: false, follow: false } };

export default function MilanPage({ params }: PageProps<"/milan/[slug]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <MilanView params={params} />
    </Suspense>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" className="h-36 w-36" aria-hidden>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#ead9c8" strokeWidth="10" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="#9a3412"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${(score / 36) * c} ${c}`}
        transform="rotate(-90 60 60)"
      />
    </svg>
  );
}

function DoshaCard({ title, koot, aboutKey }: { title: React.ReactNode; koot: Koot; aboutKey: string }) {
  const cancel = cancellationLabel(koot.cancelled_by);
  const state = doshaState(koot);
  const tone = { none: "border-good/40 bg-good-bg", cancelled: "border-warn/40 bg-warn-bg", present: "border-bad/40 bg-bad-bg" }[state];
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-sm">
        {state === "none" && <>No dosha · {points(koot.earned)} / {koot.max_points}</>}
        {state === "present" && <span className="font-semibold text-bad">Present · {points(koot.earned)} / {koot.max_points}</span>}
        {state === "cancelled" && (
          <>
            <span className="font-semibold text-warn">Present — cancelled ✓</span>
            <span className="block text-muted">{cancel}</span>
            <span className="block">{points(koot.earned)} / {koot.max_points}</span>
          </>
        )}
      </p>
      {state !== "none" && <RatingLine rating={rateKootDosha(koot, cancel)} kind="dosha" />}
      {state !== "none" && <AboutToggle itemKey={aboutKey} label="About this Dosha" />}
    </div>
  );
}

function KootRow({ k, index, first }: { k: Koot; index: number; first: boolean }) {
  const meta = KOOTS.find((x) => x.api === k.koot);
  const cancel = cancellationLabel(k.cancelled_by);
  return (
    <li className="border-b border-border/60 last:border-0">
      <details className="group py-3">
        <summary className="flex cursor-pointer list-none items-center gap-3">
          <span className="w-5 text-xs text-muted">{index + 1}</span>
          <span className="flex-1">
            <span className="font-semibold">{kootLabel(k.koot)}</span>
            {first && meta?.label.meaning && <span className="text-sm text-muted"> ({meta.label.meaning})</span>}
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-border">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${(k.earned / k.max_points) * 100}%` }} />
            </span>
          </span>
          <span className="w-16 text-right font-bold tabular-nums">
            {points(k.earned)} / {k.max_points}
          </span>
          <span aria-label={k.passed ? "passed" : "not passed"} className={k.passed ? "text-good" : "text-bad"}>
            {k.passed ? "✓" : "✗"}
          </span>
        </summary>
        <div className="mt-2 space-y-1 pl-8 text-sm">
          {k.dosha && <Chip tone={cancel ? "warn" : "bad"}>{cancel ? `${k.dosha} — cancelled` : k.dosha}</Chip>}
          {cancel && <p className="text-muted">Cancellation: {cancel}</p>}
          {k.skipped && <p className="text-muted">Skipped{k.skip_reason ? `: ${k.skip_reason}` : ""}</p>}
          {comparedText(k) && <p className="text-muted">What was compared: {comparedText(k)}</p>}
        </div>
      </details>
    </li>
  );
}

async function MilanView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const match = await loadMatch(slug);
  if (!match) notFound();
  const milan = match.milanResult.result as Milan;
  const koots = sortKoots(milan.koots);
  const nadi = koots.find((k) => k.koot === "Nadi")!;
  const bhakoot = koots.find((k) => k.koot === "Bhakoot")!;
  const v = verdict(milan.verdict);
  const [session, editable] = await Promise.all([auth(), canModify(match.userId)]);

  const people = [
    { role: "Groom", p: match.boyProfile },
    { role: "Bride", p: match.girlProfile },
  ].map(({ role, p }) => ({ role, p, chart: chartOf(p.birthChart) }));
  const [groom, bride] = people;
  const nearBoundary = people.filter(({ chart }) => nearNakshatraBoundary(chart.grahas.find((g) => g.name === "Moon")!.longitude));
  const toneCls = { good: "bg-good-bg text-good", ok: "bg-warn-bg text-warn", low: "bg-bad-bg text-bad" }[v.tone];

  return (
    <div>
      {/* 1. Names */}
      <details className="card mb-4">
        <summary className="cursor-pointer list-none">
          <p className="text-sm font-semibold text-brand">
            <Term id="kundliMilan" full />
          </p>
          <h1 className="text-xl font-extrabold">
            <Link href={`/kundli/${groom.p.slug}`} className="underline decoration-brand/40 underline-offset-4 hover:text-brand">
              {groom.p.name}
            </Link>{" "}
            <span className="text-sm font-normal text-muted">(Groom)</span> ·{" "}
            <Link href={`/kundli/${bride.p.slug}`} className="underline decoration-brand/40 underline-offset-4 hover:text-brand">
              {bride.p.name}
            </Link>{" "}
            <span className="text-sm font-normal text-muted">(Bride)</span>
          </h1>
          <p className="text-xs text-muted underline">Birth details</p>
        </summary>
        <div className="mt-3 space-y-3">
          {people.map(({ role, p }) => (
            <div key={role} className="text-sm">
              <p className="font-semibold">
                {role}:{" "}
                <Link href={`/kundli/${p.slug}`} className="text-brand underline">
                  {p.name}
                </Link>
              </p>
              <p className="text-muted">{birthDateTime(p.birthDate, p.birthTime)}</p>
              {editable ? (
                <PlaceEdit slug={p.slug} label={p.placeLabel} />
              ) : (
                <p>📍 {p.placeLabel}</p>
              )}
            </div>
          ))}
        </div>
      </details>

      {/* 2. Score hero */}
      <section className="card mb-4 flex flex-col items-center text-center">
        <div className="relative">
          <ScoreRing score={milan.total_36} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-extrabold tabular-nums">{points(milan.total_36)}</span>
            <span className="text-sm text-muted">/ 36</span>
          </div>
        </div>
        <p className="sr-only">
          Gun Milan score {points(milan.total_36)} out of 36
        </p>
        <span className={`mt-2 rounded-full px-4 py-1 text-base font-bold ${toneCls}`}>{v.en}</span>
        <p className="mt-3 text-sm text-muted">Traditionally, 18 or more out of 36 is considered acceptable for Gun Milan.</p>
        <p className="text-sm text-muted">Gun Milan is one traditional factor among many.</p>
      </section>

      {/* 3. Dosha alerts */}
      <AboutProvider type="milan" slug={slug}>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DoshaCard title={<><Term id="nadiDosha" /> <span className="font-normal text-muted">(8 points)</span></>} koot={nadi} aboutKey="nadiDosha" />
          <DoshaCard title={<><Term id="bhakootDosha" /> <span className="font-normal text-muted">(7 points)</span></>} koot={bhakoot} aboutKey="bhakootDosha" />
        </div>
        {[nadi, bhakoot].some((k) => doshaState(k) === "cancelled") && <Note>{PARTIAL_POINTS_NOTE}</Note>}
      </AboutProvider>

      {/* 4. Manglik and other Doshas for both (loaded lazily) */}
      <Suspense fallback={<DoshasSkeleton label="Checking Manglik and other Doshas…" />}>
        <MilanDoshas groom={groom.p} bride={bride.p} />
      </Suspense>

      {/* 5. Ashtakoot table */}
      <Section title={<><Term id="ashtakoot" full /> — all 8 Koots</>}>
        <p className="mb-1 text-xs text-muted">Tap a koot to see what was compared.</p>
        <ul>
          {koots.map((k, i) => (
            <KootRow key={k.koot} k={k} index={i} first />
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t-2 border-foreground/20 pt-2 font-extrabold">
          <span>Total</span>
          <span className="tabular-nums">{points(milan.total_36)} / 36</span>
        </div>
        <div className="mt-3 text-xs text-muted">
          Chandra (Moon): Groom {rashi(groom.chart.grahas.find((g) => g.name === "Moon")!.sign_num)},{" "}
          {nakshatra(groom.chart.grahas.find((g) => g.name === "Moon")!.nakshatra_num)} · Bride{" "}
          {rashi(bride.chart.grahas.find((g) => g.name === "Moon")!.sign_num)},{" "}
          {nakshatra(bride.chart.grahas.find((g) => g.name === "Moon")!.nakshatra_num)}
        </div>
        <Attribution data={match.milanResult.attribution as AttributionData} />
      </Section>

      {/* 6. Accuracy */}
      {nearBoundary.length > 0 && (
        <Note title="Birth time accuracy matters">
          {nearBoundary.map(({ role }) => (
            <p key={role}>
              The {role}&apos;s Moon is close to a Nakshatra boundary, so a small birth-time error could change the score.
            </p>
          ))}
        </Note>
      )}

      {/* 7–9. AI, follow-ups, actions */}
      <ReadingPanel kind="milan" slug={slug} />
      <FollowupBox kind="milan" slug={slug} />
      <ItemActions
        kind="milan"
        type="match"
        slug={slug}
        canSave={Boolean(session?.user)}
        saved={Boolean(match.userId)}
        shareText={`Gun Milan for ${groom.p.name} & ${bride.p.name} on Grahavani:`}
      />
    </div>
  );
}

type MilanProfile = NonNullable<Awaited<ReturnType<typeof loadMatch>>>["boyProfile"];

/** Manglik summary for both, the combined line, and each person's full Dosha cards. */
async function MilanDoshas({ groom, bride }: { groom: MilanProfile; bride: MilanProfile }) {
  const [g, b] = await Promise.all([loadDoshaData(groom.birthChart), loadDoshaData(bride.birthChart)]);
  const people = [
    { role: "Groom", p: groom, data: g },
    { role: "Bride", p: bride, data: b },
  ];
  return (
    <>
      <Section title={<Term id="manglik" full />}>
        <div className="grid gap-3 sm:grid-cols-2">
          {people.map(({ role, data }) => {
            const m = data.manglik;
            return (
              <div key={role} className="rounded-xl border border-border p-3">
                <p className="text-sm font-bold">
                  {role}:{" "}
                  {!m ? (
                    <span className="font-normal text-muted">
                      Not available — <RetryButton />
                    </span>
                  ) : m.manglik ? (
                    <span className="text-warn">Manglik — {severity(m.severity)}</span>
                  ) : (
                    <span className="text-good">Not Manglik</span>
                  )}
                </p>
                {m && (
                  <div className="mt-2">
                    <ManglikChecks m={m} />
                    {m.cancellations.length > 0 && <p className="mt-2 text-xs text-muted">Cancellations: {m.cancellations.join("; ")}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {g.manglik && b.manglik && (
          <p className="mt-3 rounded-lg bg-background px-3 py-2 text-sm font-semibold">{manglikCombined(g.manglik, b.manglik)}</p>
        )}
      </Section>
      {people.map(({ role, p, data }) => (
        <details key={role} className="card mb-4">
          <summary className="cursor-pointer list-none">
            <span className="h2">{role}&apos;s Doshas</span>
            <span className="block text-xs text-muted">Manglik, Kaal Sarp, Kemadruma, Sade Sati and Shani Dhaiya — tap to open</span>
          </summary>
          <div className="mt-3">
            <AboutProvider type="kundli" slug={p.slug}>
              <DoshaCards cards={buildDoshas({ ...data, asOf: data.chart.vimshottari.current.as_of })} />
            </AboutProvider>
            <p className="mt-3">
              <KundliLink slug={p.slug} label={`View the ${role}'s full Kundli →`} />
            </p>
          </div>
        </details>
      ))}
    </>
  );
}
