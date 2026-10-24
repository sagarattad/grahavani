import { NorthIndianChart } from "./NorthIndianChart";
import { Tabs } from "./Tabs";
import { Chip, Note, Section, Term } from "./ui";
import { PlaceEdit } from "./PlaceEdit";
import { d1Houses, d9Houses } from "@/lib/chart/northIndian";
import { dignity, graha, grahaWithMeaning, nakshatra, rashi } from "@/lib/glossary";
import { birthDateTime, dateOnly, dms, ymd } from "@/lib/format";
import { antardashas, contains } from "@/lib/dasha";
import { yogaChecklist } from "@/lib/yogas";
import { WindowList } from "./periods";
import { AboutToggle } from "./About";
import { RatingLine } from "./rating";
import { RATING_NOTE } from "@/lib/strength";
import { nearSignBoundary } from "@/lib/accuracy";
import type { Chart, DashaCurrent } from "@/lib/kundlit-schemas";

export function PersonHeader({
  title,
  name,
  birthDate,
  birthTime,
  placeLabel,
  slug,
  canEdit,
}: {
  title: React.ReactNode;
  name: string;
  birthDate: string;
  birthTime: string;
  placeLabel: string;
  slug: string;
  canEdit: boolean;
}) {
  return (
    <header className="mb-4">
      <p className="text-sm font-semibold text-brand">{title}</p>
      <h1 className="text-2xl font-extrabold">{name}</h1>
      <p className="text-sm text-muted">{birthDateTime(birthDate, birthTime)}</p>
      {canEdit ? (
        <PlaceEdit slug={slug} label={placeLabel} />
      ) : (
        <p className="text-sm">📍 {placeLabel}</p>
      )}
    </header>
  );
}

export function BoundaryNotes({ chart }: { chart: Chart }) {
  const moon = chart.grahas.find((g) => g.name === "Moon")!;
  const items = [
    nearSignBoundary(chart.lagna.deg_in_sign) && `Lagna is at ${dms(chart.lagna.deg_in_sign)} in ${rashi(chart.lagna.sign_num)}, close to a Rashi boundary.`,
    nearSignBoundary(moon.deg_in_sign) && `Chandra (Moon) is at ${dms(moon.deg_in_sign)} in ${rashi(moon.sign_num)}, close to a Rashi boundary.`,
  ].filter(Boolean) as string[];
  if (!items.length) return null;
  return (
    <Note title="Birth time accuracy matters">
      {items.map((i) => (
        <p key={i}>{i}</p>
      ))}
      <p>A few minutes&apos; difference in birth time could change this. Please double-check the birth time.</p>
    </Note>
  );
}

export function ChartsSection({ chart }: { chart: Chart }) {
  return (
    <Section title={<>Charts</>}>
      <Tabs
        tabs={[
          {
            id: "d1",
            label: <>Lagna chart (D1)</>,
            content: <NorthIndianChart houses={d1Houses(chart)} title="Lagna chart (D1)" />,
          },
          {
            id: "d9",
            label: <>Navamsa (D9)</>,
            content: <NorthIndianChart houses={d9Houses(chart)} title="Navamsa chart (D9)" />,
          },
        ]}
      />
    </Section>
  );
}

export function PlanetTable({ chart }: { chart: Chart }) {
  return (
    <Section
      title={
        <>
          <Term id="graha" full /> positions
        </>
      }
    >
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b border-border">
              <th className="sticky left-0 bg-surface py-2 pr-2">Graha</th>
              <th className="py-2 pr-2">
                <Term id="sign" full />
              </th>
              <th className="py-2 pr-2">Degree</th>
              <th className="py-2 pr-2">
                <Term id="nakshatra" />-<Term id="pada" />
              </th>
              <th className="py-2 pr-2">
                <Term id="bhava" full />
              </th>
              <th className="py-2 pr-2" title="Vakri (retrograde)">R</th>
              <th className="py-2 pr-2" title="Asta (combust)">C</th>
              <th className="py-2" title="Baladi avastha: the graha's age state">Avastha</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/60 font-semibold text-warn">
              <td className="sticky left-0 bg-surface py-2 pr-2">Lagna</td>
              <td className="py-2 pr-2">{rashi(chart.lagna.sign_num)}</td>
              <td className="py-2 pr-2">{dms(chart.lagna.deg_in_sign)}</td>
              <td className="py-2 pr-2">
                {nakshatra(chart.lagna.nakshatra_num)}-{chart.lagna.pada}
              </td>
              <td className="py-2 pr-2">1</td>
              <td />
              <td />
              <td />
            </tr>
            {chart.grahas.map((g) => (
              <tr key={g.name} className="border-b border-border/60">
                <td className="sticky left-0 bg-surface py-2 pr-2 font-semibold">
                  {grahaWithMeaning(g.name)}
                  {g.dignity !== "neutral" && <span className="block text-xs font-normal text-muted">{dignity(g.dignity)}</span>}
                </td>
                <td className="py-2 pr-2">{rashi(g.sign_num)}</td>
                <td className="py-2 pr-2">{dms(g.deg_in_sign)}</td>
                <td className="py-2 pr-2">
                  {nakshatra(g.nakshatra_num)}-{g.pada}
                </td>
                <td className="py-2 pr-2">{g.house}</td>
                <td className="py-2 pr-2">{g.retrograde ? "R" : ""}</td>
                <td className="py-2 pr-2">{g.combust ? "C" : ""}</td>
                <td className="py-2">{g.avastha ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        R = <Term id="vakri" full />. C = <Term id="asta" full />. Rahu and Ketu always move in reverse. Avastha = Baladi
        avastha (age state: Bala, Kumara, Yuva, Vriddha, Mrita).
      </p>
    </Section>
  );
}

export function LagnaDetails({ chart }: { chart: Chart }) {
  const moon = chart.grahas.find((g) => g.name === "Moon")!;
  const rows: [React.ReactNode, React.ReactNode][] = [
    [<Term key="l" id="lagna" full />, `${rashi(chart.lagna.sign_num)} ${dms(chart.lagna.deg_in_sign)}`],
    ["Lagna Nakshatra", `${nakshatra(chart.lagna.nakshatra_num)}, Pada ${chart.lagna.pada}`],
    ["Lagna lord", grahaWithMeaning(chart.lagna.lord)],
    [<Term key="r" id="rashi" full />, rashi(moon.sign_num)],
    ["Janma Nakshatra", `${nakshatra(moon.nakshatra_num)}, Pada ${moon.pada}`],
    ["Navamsa Lagna", rashi(chart.navamsha_lagna.sign_num)],
  ];
  return (
    <Section title="Lagna details">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v], i) => (
          <div key={i} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function DashaSection({ chart, current }: { chart: Chart; current: DashaCurrent }) {
  const asOf = new Date(current.as_of).getTime();
  const { timeline } = chart.vimshottari;
  const rows = [
    { label: <Term id="mahadasha" full />, p: current.mahadasha },
    { label: <Term id="antardasha" full />, p: current.antardasha },
    { label: <Term id="pratyantardasha" full />, p: current.pratyantardasha },
  ];
  return (
    <Section title={<Term id="vimshottari" full />}>
      <h3 className="mb-2 text-sm font-bold">Running now</h3>
      <ul className="mb-4 space-y-2">
        {rows.map(({ label, p }, i) => (
          <li key={i} className="flex items-center justify-between rounded-xl bg-background px-3 py-2 text-sm">
            <span>
              <span className="block text-xs text-muted">{label}</span>
              <span className="font-bold">{grahaWithMeaning(p.lord)}</span>
            </span>
            <span className="text-right text-xs text-muted">
              ends
              <span className="block text-sm font-semibold text-foreground">{dateOnly(p.end)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mb-4 text-xs text-muted">
        Dasha balance at birth: {graha(chart.vimshottari.birth.mahadasha.lord)} Mahadasha, {ymd(chart.vimshottari.birth.mahadasha.balance_ymd)}.
        As of {dateOnly(current.as_of)}. All dates in IST.
      </p>
      <h3 className="mb-2 text-sm font-bold">Mahadasha timeline</h3>
      <p className="mb-2 text-xs text-muted">Tap a Mahadasha to see its Antardashas.</p>
      <ol className="space-y-1 text-sm">
        {timeline.map((p) => {
          const active = contains(p, asOf);
          return (
            <li key={p.start}>
              <details open={active} className="group">
                <summary
                  className={`flex cursor-pointer list-none justify-between rounded-lg px-3 py-2 ${active ? "bg-brand text-white" : "bg-background"}`}
                >
                  <span className="font-semibold">{grahaWithMeaning(p.lord)}</span>
                  <span>
                    {dateOnly(p.start)} – {dateOnly(p.end)}
                  </span>
                </summary>
                <ul className="mt-1 space-y-0.5 pl-4">
                  {antardashas(p, timeline).map((ad) => {
                    const now = contains(ad, asOf);
                    return (
                      <li key={ad.start} className={`flex justify-between rounded px-2 py-1 text-xs ${now ? "bg-warn-bg font-bold" : ""}`}>
                        <span>
                          {graha(p.lord)} – {graha(ad.lord)}
                          {now && " (running now)"}
                        </span>
                        <span>
                          {dateOnly(ad.start)} – {dateOnly(ad.end)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-muted">
        Mahadasha dates are from Kundlit. Antardashas are split from them with the standard Vimshottari proportions.
      </p>
    </Section>
  );
}

export function YogasSection({ chart, asOf }: { chart: Chart; asOf: string }) {
  const { present, absent } = yogaChecklist(chart, asOf);
  return (
    <Section title={<Term id="yoga" full />}>
      {present.length === 0 && <p className="text-sm text-muted">No yogas were reported for this chart.</p>}
      <ul className="space-y-3">
        {present.map((y) => (
          <li key={y.key} className="rounded-xl border border-border p-3 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{y.name}</span>
              {y.status === "cancelled" ? <Chip tone="warn">Present — cancelled (Bhanga)</Chip> : <Chip tone="good">Present</Chip>}
              {y.category && <Chip tone="muted">{y.category}</Chip>}
            </p>
            {y.meaning && <p className="mt-0.5 text-xs text-muted">{y.meaning}</p>}
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {y.combinations.map((c, i) => (
                <li key={i}>{c.claim}</li>
              ))}
            </ul>
            {y.cancellations.map((c, i) => (
              <p key={i} className="mt-2 text-warn">
                Bhanga: {c}
              </p>
            ))}
            <RatingLine rating={y.rating} kind="yoga" />
            <AboutToggle itemKey={y.key} label="About this Yoga" />
            <div className="mt-2 text-xs">
              <span className="font-semibold">When active: </span>
              {y.nabhasa ? (
                <span className="text-muted">effective throughout life (Nabhasa yoga)</span>
              ) : (
                <WindowList windows={y.windows} empty="no upcoming period of its grahas" />
              )}
            </div>
          </li>
        ))}
      </ul>
      {absent.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 text-sm font-bold">Not present in this chart</h3>
          <p className="text-sm text-muted">{absent.map((a) => a.name).join(" · ")}</p>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        &ldquo;When active&rdquo;: traditionally, a yoga gives its results in the Dasha periods of the grahas that form it.
      </p>
      <p className="mt-1 text-xs text-muted">{RATING_NOTE}</p>
    </Section>
  );
}
