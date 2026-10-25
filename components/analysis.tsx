// Grahavani's interpretation blocks: functional nature, marriage (D9) and
// career (D10) factors, Dasha-lord readings with transit overlaps, and the
// birth-time sensitivity warning. All from lib/astro (rule-based, tested).
import { Section } from "./ui";
import { graha, grahaWithMeaning, rashi } from "@/lib/glossary";
import { dateOnly } from "@/lib/format";
import { functionalNature } from "@/lib/astro/functional";
import { ownHouseLords } from "@/lib/astro/rules";
import { atmakaraka, marriageFactors } from "@/lib/astro/marriage";
import {
  birthTimeCheck,
  careerD10,
  transitOverlaps,
} from "@/lib/astro/timing-checks";
import { readDashaLord } from "@/lib/astro/dasha-lords";
import { dignityText } from "@/lib/astro/relations";
import { groupYogas } from "@/lib/yogas";
import type { Chart, DashaCurrent } from "@/lib/kundlit-schemas";

const list = (xs: string[]) => (xs.length ? xs.map(graha).join(", ") : "none");

function Rows({ rows }: { rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Yogakaraka, functional benefics / malefics, marakas and own-house lords (inside Lagna details). */
export function FunctionalNature({ chart }: { chart: Chart }) {
  const f = functionalNature(chart.lagna.sign_num);
  const own = ownHouseLords(chart);
  return (
    <div className="mt-4">
      <h3 className="mb-2 text-sm font-bold">
        Functional nature for {rashi(chart.lagna.sign_num)} Lagna
      </h3>
      <Rows
        rows={[
          [
            "Yogakaraka",
            f.yogakarakas.length
              ? f.yogakarakas
                  .map(
                    (p) =>
                      `${graha(p)} (rules ${f.roles[p].houses.join(" and ")})`,
                  )
                  .join(", ")
              : "none for this Lagna",
          ],
          ["Functional benefics", list(f.benefics)],
          ["Functional malefics", list(f.malefics)],
          ["Marakas (2nd and 7th lords)", list(f.marakas)],
          ["Badhaka", graha(f.badhaka)],
          ["Atmakaraka (7-karaka scheme)", graha(atmakaraka(chart))],
          ...(own.length
            ? ([
                [
                  "Own-house lords",
                  own
                    .map((o) =>
                      o.text.replace(
                        / lord (\w+) /,
                        (_m, p) => ` lord ${graha(p)} `,
                      ),
                    )
                    .join("; "),
                ],
              ] as [string, string][])
            : []),
        ]}
      />
    </div>
  );
}

/** Minutes until the D1 / D9 Lagna change sign; shown as a warning when under 10 minutes. */
export function birthTimeNotes(chart: Chart): string[] {
  return birthTimeCheck(chart, rashi)?.notes ?? [];
}

export function MarriageCareerSection({ chart }: { chart: Chart }) {
  const m = marriageFactors(chart);
  const d10 = careerD10(chart);
  const bt = birthTimeCheck(chart, rashi);
  return (
    <Section title="Marriage and career factors (D9 / D10)">
      <h3 className="mb-2 text-sm font-bold">Marriage (D1 and Navamsa)</h3>
      {bt?.warn && (
        <p className="mb-2 rounded-lg bg-warn-bg px-3 py-2 text-xs text-warn">
          {bt.notes.join(" ")} D9-based statements are sensitive to the exact
          birth time.
        </p>
      )}
      <Rows
        rows={[
          [
            "D1 7th lord",
            `${grahaWithMeaning(m.d1.seventhLord)} in Bhava ${m.d1.lordHouse} (${m.d1.lordStrength})`,
          ],
          ["Venus (D1)", `${m.d1.venusDignity} (${m.d1.venusStrength})`],
          ["D9 Lagna", rashi(m.d9.lagnaSign)],
          [
            "D9 7th and its lord",
            `${rashi(m.d9.seventhSign)}, lord ${graha(m.d9.seventhLord)} in D9 ${rashi(m.d9.lordD9Sign)}: ${dignityText(m.d9.lordD9Dignity)}${m.d9.lordVargottama ? ", Vargottama" : ""}`,
          ],
          [
            "Venus (D9)",
            `${rashi(m.d9.venusD9Sign)}: ${dignityText(m.d9.venusD9Dignity)}`,
          ],
          [
            "Darakaraka",
            `${grahaWithMeaning(m.darakaraka.planet)} (${m.darakaraka.scheme}${m.darakaraka.eightKaraka !== m.darakaraka.planet ? `; 8-karaka scheme: ${graha(m.darakaraka.eightKaraka)}` : ""})`,
          ],
          [
            "Upapada Lagna",
            `${rashi(m.upapada.sign)} (lord ${graha(m.upapada.lord)})`,
          ],
        ]}
      />
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {m.comparison.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <h3 className="mb-2 mt-5 text-sm font-bold">Career (D10, Dashamsha)</h3>
      {d10 ? (
        <>
          <Rows
            rows={[
              ["D10 Lagna", rashi(d10.lagnaSign)],
              [
                "D10 10th and its lord",
                `${rashi(d10.tenthSign)}, lord ${graha(d10.tenthLord)}`,
              ],
              ...d10.planets.map(
                (p) =>
                  [
                    `${graha(p.name)} in D10`,
                    `${rashi(p.sign)}: ${p.dignity}`,
                  ] as [string, string],
              ),
            ]}
          />
        </>
      ) : (
        <p className="text-sm text-muted">
          D10 data is not available for this chart yet.
        </p>
      )}
      <p className="mt-3 text-xs text-muted">
        Darakaraka uses the 7-karaka (Jaimini) scheme. Upapada is the arudha of
        the 12th house. Not computed: Sarvashtakavarga; full Shadbala (only
        partial components are used).
      </p>
    </Section>
  );
}

/** How the running Mahadasha and Antardasha lords read, and Saturn transits over these periods. */
export function DashaLords({
  chart,
  current,
}: {
  chart: Chart;
  current: DashaCurrent;
}) {
  const yogas = groupYogas(chart, current.as_of);
  const lords = [
    {
      label: "Mahadasha lord",
      r: readDashaLord(chart, current.mahadasha.lord, yogas),
    },
    {
      label: "Antardasha lord",
      r: readDashaLord(chart, current.antardasha.lord, yogas),
    },
  ];
  const tr = transitOverlaps(chart, current.as_of);
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-sm font-bold">
        How the running period lords read
      </h3>
      <ul className="space-y-2 text-sm">
        {lords.map(({ label, r }) => (
          <li key={label} className="rounded-xl bg-background px-3 py-2">
            <span className="block text-xs text-muted">
              {label}: {grahaWithMeaning(r.lord)} ({r.strength.level})
            </span>
            {r.summary.join("; ")}.
          </li>
        ))}
      </ul>
      {tr.overlaps.length > 0 && (
        <>
          <h3 className="mb-1 mt-3 text-sm font-bold">
            Saturn transits overlapping these periods
          </h3>
          <ul className="space-y-0.5 text-xs">
            {tr.overlaps.map((o) => (
              <li key={o.transit + o.period}>
                {o.transit}, {dateOnly(o.from)} – {dateOnly(o.to)} · overlaps{" "}
                {o.period.split("–").map(graha).join("–")} (
                {dateOnly(o.periodFrom)} – {dateOnly(o.periodTo)})
              </li>
            ))}
          </ul>
        </>
      )}
      {tr.jupiterNow && (
        <p className="mt-2 text-xs text-muted">
          Jupiter is transiting {rashi(tr.jupiterNow.sign)} now,{" "}
          {tr.jupiterNow.fromMoon} from the Moon (Kundlit gives Jupiter&apos;s
          current sign only).
        </p>
      )}
    </div>
  );
}
