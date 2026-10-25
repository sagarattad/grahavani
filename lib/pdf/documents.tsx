// The three PDF documents. They take plain data (no database access), so tests
// can render them straight from the Kundlit fixtures.
import { Text, View } from "@react-pdf/renderer";
import { d1Houses, d9Houses } from "../chart/northIndian";
import {
  KOOTS,
  cancellationLabel,
  graha,
  grahaWithMeaning,
  kootLabel,
  nakshatra,
  rashi,
  severity,
  verdict,
} from "../glossary";
import { birthDateTime, dashaBalanceText, dateOnly, dms, points } from "../format";
import { nearNakshatraBoundary, nearSignBoundary } from "../accuracy";
import { MANGLIK_CHECKS, comparedText, doshaState, manglikCombined, manglikStatus, sortKoots } from "../summaries";
import { sharedLinkText, sharedLinks, yogaChecklist } from "../yogas";
import { windowText, windowsText } from "../periods";
import { rangeText, saturnReturnLines, type DoshaCard } from "../doshas";
import { ABOUT_DOSHA_STATUSES, type AboutTexts } from "../ai/about";
import { PARTIAL_POINTS_NOTE, RATING_NOTE, rateKootDosha, type Rating } from "../strength";
import { chartStrengths } from "../astro/planet-strength";
import { dignityText } from "../astro/relations";
import { functionalNature } from "../astro/functional";
import { ownHouseLords } from "../astro/rules";
import { atmakaraka, marriageFactors } from "../astro/marriage";
import { MIN_WINDOW_DAYS, marriageTiming } from "../astro/marriage-timing";
import { birthTimeCheck, careerD10, transitOverlaps, vargaCaveat } from "../astro/timing-checks";
import { readDashaLord } from "../astro/dasha-lords";
import { groupYogas } from "../yogas";
import type { Attribution, Chart, DashaCurrent, Koot, Manglik, Milan } from "../kundlit-schemas";
import { PdfChart } from "./chart";
import { C, KeyValues, NoteBox, PdfDoc, PersonLine, ReadingSection, Section, Table, latin, s, type PdfPerson, type Reading } from "./layout";

const moonOf = (c: Chart) => c.grahas.find((g) => g.name === "Moon")!;

// ---------- Kundli ----------

export type KundliPdfData = {
  person: PdfPerson;
  chart: Chart;
  dasha: DashaCurrent;
  doshas: DoshaCard[];
  about?: AboutTexts | null; // cached "About" texts, null if not generated yet
  attribution: Attribution;
  reading: Reading | null;
};


export function KundliPdf({ person, chart, dasha, doshas, about, attribution, reading }: KundliPdfData) {
  const moon = moonOf(chart);
  const asOf = new Date(dasha.as_of).getTime();
  const boundary = [
    nearSignBoundary(chart.lagna.deg_in_sign) && `Lagna is at ${dms(chart.lagna.deg_in_sign)} in ${rashi(chart.lagna.sign_num)}, close to a Rashi boundary.`,
    nearSignBoundary(moon.deg_in_sign) && `Chandra (Moon) is at ${dms(moon.deg_in_sign)} in ${rashi(moon.sign_num)}, close to a Rashi boundary.`,
    ...(birthTimeCheck(chart, rashi)?.notes ?? []),
  ].filter(Boolean) as string[];
  const strengths = chartStrengths(chart);
  const fn = functionalNature(chart.lagna.sign_num);
  const own = ownHouseLords(chart);
  const yogas = groupYogas(chart, dasha.as_of);
  const lords = [
    ["Mahadasha lord", readDashaLord(chart, dasha.mahadasha.lord, yogas, strengths)],
    ["Antardasha lord", readDashaLord(chart, dasha.antardasha.lord, yogas, strengths)],
  ] as const;
  const transits = transitOverlaps(chart, dasha.as_of);

  return (
    <PdfDoc
      title={`Kundli — ${person.name}`}
      attributions={[attribution]}
      heading={
        <View>
          <Text style={s.title}>{person.name}</Text>
          <Text style={s.subtitle}>Kundli (birth chart)</Text>
          <PersonLine p={person} />
        </View>
      }
    >
      <NoteBox
        title="Birth time accuracy matters"
        lines={boundary.length ? [...boundary, "A few minutes' difference in birth time could change this."] : []}
      />
      <Section title="Charts" keepTogether>
        <View style={[s.row, { justifyContent: "space-around" }]}>
          <PdfChart houses={d1Houses(chart)} title="Lagna chart (D1)" width={230} />
          <PdfChart houses={d9Houses(chart)} title="Navamsa (D9)" width={230} />
        </View>
        <Text style={[s.small, { marginTop: 4, textAlign: "center" }]}>
          Numbers are Rashi numbers (1 = Mesha … 12 = Meena). La = Lagna, R = Vakri (retrograde), C = Asta (combust).
        </Text>
      </Section>

      <Section title="Graha (planet) positions">
        <Table
          cols={[
            ["Graha", 2.3],
            ["Rashi (sign)", 1.2],
            ["Degree", 0.9],
            ["Nakshatra-Pada", 1.7],
            ["Bhava", 0.7, "center"],
            ["R", 0.3, "center"],
            ["C", 0.3, "center"],
            ["D9", 1.5],
            ["Strength", 0.9, "center"],
            ["Avastha", 0.9, "center"],
          ]}
          rows={[
            ["Lagna", rashi(chart.lagna.sign_num), dms(chart.lagna.deg_in_sign), `${nakshatra(chart.lagna.nakshatra_num)}-${chart.lagna.pada}`, "1", "", "", rashi(chart.navamsha_lagna.sign_num), "", ""],
            ...chart.grahas.map((g) => {
              const st = strengths.get(g.name)!;
              return [
                grahaWithMeaning(g.name) + (st.dignity ? ` · ${st.dignity.label}` : ""),
                rashi(g.sign_num),
                dms(g.deg_in_sign),
                `${nakshatra(g.nakshatra_num)}-${g.pada}`,
                String(g.house),
                g.retrograde ? "R" : "",
                g.combust ? "C" : "",
                `${rashi(g.navamsha.sign_num)}${st.d9Dignity ? ` · ${st.d9Dignity.label}` : ""}${g.vargottama ? " · Vargottama" : ""}`,
                st.borderline ? `${st.level} (borderline)` : st.level,
                g.avastha ?? "-",
              ];
            }),
          ]}
        />
        <Text style={[s.small, { marginTop: 4 }]}>
          R = Vakri (retrograde). C = Asta (combust). Rahu and Ketu always move in reverse. Dignity after each name is the compound (natural +
          temporary) relation to the sign lord. Strength: Grahavani&apos;s composite (dignity, house, D9, combustion, retrogression, the Moon&apos;s paksha;
          Baladi avastha minor). Not computed: full Shadbala, Sarvashtakavarga.
        </Text>
      </Section>

      <Section title="Lagna details" keepTogether>
        <KeyValues
          rows={[
            ["Lagna (ascendant)", `${rashi(chart.lagna.sign_num)} ${dms(chart.lagna.deg_in_sign)}`],
            ["Lagna Nakshatra", `${nakshatra(chart.lagna.nakshatra_num)}, Pada ${chart.lagna.pada}`],
            ["Lagna lord", grahaWithMeaning(chart.lagna.lord)],
            ["Rashi (Moon sign)", rashi(moon.sign_num)],
            ["Janma Nakshatra", `${nakshatra(moon.nakshatra_num)}, Pada ${moon.pada}`],
            ["Navamsa Lagna", rashi(chart.navamsha_lagna.sign_num)],
            ["Yogakaraka", fn.yogakarakas.length ? fn.yogakarakas.map((p) => `${graha(p)} (rules ${fn.roles[p].houses.join(" and ")})`).join(", ") : "none for this Lagna"],
            ["Functional benefics", fn.benefics.map(graha).join(", ") || "none"],
            ["Functional malefics", fn.malefics.map(graha).join(", ") || "none"],
            ["Marakas (2nd and 7th lords)", fn.marakas.map(graha).join(", ")],
            ["Badhaka", graha(fn.badhaka)],
            ["Atmakaraka (7-karaka scheme)", graha(atmakaraka(chart))],
            ...(own.length ? ([["Own-house lords", own.map((o) => o.text).join("; ")]] as [string, string][]) : []),
          ]}
        />
      </Section>

      <PdfYogas chart={chart} asOf={dasha.as_of} about={about} />
      <PdfDoshas title="Doshas" cards={doshas} about={about} />
      <PdfMarriageCareer chart={chart} asOf={dasha.as_of} />

      <Section title="Vimshottari Dasha (120-year period system)">
        <Text style={s.h3}>Running now</Text>
        <KeyValues
          rows={[
            ["Mahadasha (major period)", `${grahaWithMeaning(dasha.mahadasha.lord)} · ends ${dateOnly(dasha.mahadasha.end)}`],
            ["Antardasha (sub-period)", `${grahaWithMeaning(dasha.antardasha.lord)} · ends ${dateOnly(dasha.antardasha.end)}`],
            ["Pratyantar Dasha", `${grahaWithMeaning(dasha.pratyantardasha.lord)} · ends ${dateOnly(dasha.pratyantardasha.end)}`],
          ]}
        />
        <Text style={s.h3}>How the running period lords read</Text>
        {lords.map(([label, r]) => (
          <Text key={label} style={{ marginBottom: 2 }}>
            <Text style={s.bold}>
              {label}: {grahaWithMeaning(r.lord)} ({r.strength.level}).{" "}
            </Text>
            {latin(r.summary.join("; "))}.
          </Text>
        ))}
        {transits.overlaps.length > 0 && (
          <>
            <Text style={s.h3}>Saturn transits overlapping these periods</Text>
            {transits.overlaps.map((o) => (
              <Text key={o.transit + o.period} style={s.small}>
                {o.transit}, {dateOnly(o.from)} – {dateOnly(o.to)} · overlaps {o.period.split("–").map(graha).join("–")} ({dateOnly(o.periodFrom)} – {dateOnly(o.periodTo)})
              </Text>
            ))}
          </>
        )}
        {saturnReturnLines(chart, dasha.as_of).map((l) => (
          <Text key={l} style={[s.small, { marginTop: 3 }]}>
            {l}
          </Text>
        ))}
        <Text style={s.h3}>Jupiter transits</Text>
        <Text style={s.small}>
          Jupiter is in {rashi(transits.jupiterNow.sign)} now: house {transits.jupiterNow.fromMoon} from the Moon, {transits.jupiterNow.fromLagna} from the Lagna. Classically
          favourable from the Moon: 2, 5, 7, 9, 11.
        </Text>
        {transits.jupiter.slice(0, 12).map((j) => (
          <Text key={j.from} style={s.small}>
            {rashi(j.sign)}, {dateOnly(j.from)} – {dateOnly(j.to)} · house {j.fromMoon} from the Moon{j.favourable ? " (favourable)" : ""}, {j.fromLagna} from the Lagna · overlaps{" "}
            {j.periods.map((p) => p.split("–").map(graha).join("–")).join(", ")}
          </Text>
        ))}
        <Text style={[s.small, { marginTop: 3 }]}>
          Dasha balance at birth: {graha(chart.vimshottari.birth.mahadasha.lord)} Mahadasha,{" "}
          {dashaBalanceText(chart.vimshottari.timeline[0].start, chart.vimshottari.timeline[0])}. Dasha periods as of {dateOnly(dasha.as_of)}; the running periods
          stay current until {dateOnly(dasha.pratyantardasha.end)}.
        </Text>
        <Text style={s.h3}>Mahadasha timeline</Text>
        {chart.vimshottari.timeline.map((p) => {
          const active = new Date(p.start).getTime() <= asOf && asOf < new Date(p.end).getTime();
          return (
            <View
              key={p.start}
              style={[s.row, { paddingVertical: 2, paddingHorizontal: 4, backgroundColor: active ? C.brand : undefined, color: active ? "#fff" : C.fg }]}
            >
              <Text style={[s.bold, { flex: 1 }]}>{grahaWithMeaning(p.lord)}</Text>
              <Text>
                {dateOnly(p.start)} – {dateOnly(p.end)}
              </Text>
            </View>
          );
        })}
      </Section>

      <ReadingSection kind="kundli" reading={reading} />
    </PdfDoc>
  );
}

// ---------- Manglik ----------

export type ManglikPdfData = { person: PdfPerson; manglik: Manglik; attribution: Attribution; reading: Reading | null };

export function ManglikPdf({ person, manglik: m, attribution, reading }: ManglikPdfData) {
  return (
    <PdfDoc
      title={`Manglik Dosha — ${person.name}`}
      attributions={[attribution]}
      heading={
        <View>
          <Text style={s.title}>{person.name}</Text>
          <Text style={s.subtitle}>Manglik Dosha (Mars affliction) check</Text>
          <PersonLine p={person} />
        </View>
      }
    >
      <View style={[s.section, { alignItems: "center", backgroundColor: m.manglik ? C.warnBg : C.goodBg }]}>
        <Text style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, color: m.manglik ? C.warn : C.good }}>{manglikStatus(m)}</Text>
      </View>
      <Section title="Checks" keepTogether>
        <KeyValues rows={MANGLIK_CHECKS.map((c) => [c.label, m[c.key] ? "Triggered" : "No"] as [string, string])} />
        <Text style={s.h3}>Cancellations</Text>
        {m.cancellations.length ? m.cancellations.map((c) => <Text key={c}>• {c}</Text>) : <Text style={s.muted}>None reported.</Text>}
      </Section>
      <NoteBox title="Please note" lines={["Manglik Dosha is one traditional factor. It is not a prediction about anyone's life or marriage."]} />
      <ReadingSection kind="manglik" reading={reading} />
    </PdfDoc>
  );
}

// ---------- Gun Milan ----------

type MilanPerson = PdfPerson & { chart: Chart; manglik?: Manglik | null; doshas: DoshaCard[]; about?: AboutTexts | null };
export type MilanPdfData = {
  groom: MilanPerson;
  bride: MilanPerson;
  about?: AboutTexts | null; // Nadi / Bhakoot texts
  milan: Milan;
  attribution: Attribution;
  reading: Reading | null;
};

function DoshaBox({ title, koot, about }: { title: string; koot: Koot; about?: string }) {
  const state = doshaState(koot);
  const colors = {
    none: [C.goodBg, C.good, "No dosha"],
    cancelled: [C.warnBg, C.warn, "Present — cancelled"],
    present: [C.badBg, C.bad, "Present"],
  }[state];
  return (
    <View style={{ flex: 1, padding: 8, borderRadius: 6, backgroundColor: colors[0], borderWidth: 1, borderColor: C.border }}>
      <Text style={s.bold}>{title}</Text>
      <Text style={{ color: colors[1], fontWeight: 700 }}>
        {colors[2]} · {points(koot.earned)} / {koot.max_points}
      </Text>
      {state === "cancelled" && <Text style={s.muted}>{cancellationLabel(koot.cancelled_by)}</Text>}
      {state !== "none" && <RatingText rating={rateKootDosha(koot, cancellationLabel(koot.cancelled_by))} label="" />}
      {state !== "none" && about && <AboutText text={about} />}
    </View>
  );
}

export function MilanPdf({ groom, bride, about, milan, attribution, reading }: MilanPdfData) {
  const koots = sortKoots(milan.koots);
  const v = verdict(milan.verdict);
  const toneColor = { good: C.good, ok: C.warn, low: C.bad }[v.tone];
  const people = [
    { role: "Groom", p: groom },
    { role: "Bride", p: bride },
  ];
  const accuracy = people
    .filter(({ p }) => nearNakshatraBoundary(moonOf(p.chart).longitude))
    .map(({ role }) => `The ${role}'s Moon is close to a Nakshatra boundary, so a small birth-time error could change the score.`);

  return (
    <PdfDoc
      title={`Gun Milan — ${groom.name} & ${bride.name}`}
      attributions={[attribution]}
      heading={
        <View>
          <Text style={s.title}>
            {groom.name} & {bride.name}
          </Text>
          <Text style={s.subtitle}>Kundli Milan (Ashtakoot Gun Milan)</Text>
          <PersonLine p={groom} role="Groom" />
          <PersonLine p={bride} role="Bride" />
        </View>
      }
    >
      <View style={[s.section, { alignItems: "center" }]} wrap={false}>
        <Text style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.2 }}>
          {points(milan.total_36)} <Text style={{ fontSize: 14, color: C.muted }}>/ 36</Text>
        </Text>
        <Text style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: toneColor }}>{v.en}</Text>
        <Text style={[s.muted, { marginTop: 4 }]}>Traditionally, 18 or more out of 36 is considered acceptable for Gun Milan.</Text>
        <Text style={s.muted}>Gun Milan is one traditional factor among many.</Text>
      </View>

      <View style={[s.row, { gap: 8, marginTop: 10 }]} wrap={false}>
        <DoshaBox title="Nadi Dosha (8 points)" koot={koots.find((k) => k.koot === "Nadi")!} about={about?.nadiDosha} />
        <DoshaBox title="Bhakoot Dosha (7 points)" koot={koots.find((k) => k.koot === "Bhakoot")!} about={about?.bhakootDosha} />
      </View>
      {koots.some((k) => (k.koot === "Nadi" || k.koot === "Bhakoot") && doshaState(k) === "cancelled") && (
        <Text style={[s.small, { marginTop: 4 }]}>{PARTIAL_POINTS_NOTE}</Text>
      )}

      <Section title="Manglik Dosha (Mars affliction)" keepTogether>
        <View style={[s.row, { gap: 8 }]}>
          {people.map(({ role, p }) => (
            <View key={role} style={{ flex: 1, padding: 6, borderWidth: 1, borderColor: C.border, borderRadius: 6 }}>
              <Text style={s.bold}>
                {role}: {p.manglik ? (p.manglik.manglik ? `Manglik — ${severity(p.manglik.severity)}` : "Not Manglik") : "—"}
              </Text>
              {p.manglik &&
                MANGLIK_CHECKS.map((c) => (
                  <Text key={c.key} style={s.muted}>
                    {c.label}: {p.manglik![c.key] ? "triggered" : "no"}
                  </Text>
                ))}
              {p.manglik && p.manglik.cancellations.length > 0 && (
                <Text style={s.small}>Cancellations: {p.manglik.cancellations.join("; ")}</Text>
              )}
            </View>
          ))}
        </View>
        <Text style={[s.bold, { marginTop: 6 }]}>{manglikCombined(groom.manglik, bride.manglik)}</Text>
      </Section>

      <Section title="Ashtakoot — all 8 Koots">
        <Table
          cols={[
            ["#", 0.3],
            ["Koot", 2.2],
            ["Points", 0.9, "center"],
            ["Pass", 0.6, "center"],
            ["Dosha / what was compared", 3.4],
          ]}
          rows={koots.map((k, i) => {
            const meta = KOOTS.find((x) => x.api === k.koot);
            const cancel = cancellationLabel(k.cancelled_by);
            const extra = [k.dosha && (cancel ? `${k.dosha} — cancelled: ${cancel}` : k.dosha), k.skipped && `Skipped${k.skip_reason ? `: ${k.skip_reason}` : ""}`, comparedText(k)]
              .filter(Boolean)
              .join(" · ");
            return [
              String(i + 1),
              `${kootLabel(k.koot)}${meta?.label.meaning ? ` (${meta.label.meaning})` : ""}`,
              `${points(k.earned)} / ${k.max_points}`,
              k.passed ? "Yes" : "No",
              extra,
            ];
          })}
        />
        <View style={[s.row, { marginTop: 4, borderTopWidth: 1, borderTopColor: C.fg, paddingTop: 3 }]}>
          <Text style={[s.bold, { flex: 1 }]}>Total</Text>
          <Text style={s.bold}>{points(milan.total_36)} / 36</Text>
        </View>
        <Text style={[s.small, { marginTop: 4 }]}>
          Chandra (Moon): Groom {rashi(moonOf(groom.chart).sign_num)}, {nakshatra(moonOf(groom.chart).nakshatra_num)} · Bride{" "}
          {rashi(moonOf(bride.chart).sign_num)}, {nakshatra(moonOf(bride.chart).nakshatra_num)}
        </Text>
      </Section>

      <NoteBox title="Birth time accuracy matters" lines={accuracy} />
      {people.map(({ role, p }) => (
        <PdfDoshas key={role} title={`${role}'s Doshas`} cards={p.doshas} about={p.about} />
      ))}
      <Text style={[s.bold, { marginTop: 10 }]}>Explanation of the computed result — not advice to marry or not.</Text>
      <ReadingSection kind="milan" reading={reading} />
      <Text style={[s.small, { marginTop: 6 }]}>Birth details: {people.map(({ role, p }) => `${role} ${birthDateTime(p.birthDate, p.birthTime)}`).join(" · ")}</Text>
    </PdfDoc>
  );
}

// ---------- Shared sections ----------

function PdfYogas({ chart, asOf, about }: { chart: Chart; asOf: string; about?: AboutTexts | null }) {
  const { present, absent } = yogaChecklist(chart, asOf);
  return (
    <Section title="Yoga (planetary combinations)">
      {present.length === 0 && <Text style={s.muted}>No yogas were reported for this chart.</Text>}
      {sharedLinks(present, chart).map((l) => (
        <Text key={l.yogas.join("+")} style={[s.small, { color: C.warn, marginBottom: 4 }]}>
          {sharedLinkText(l)}
        </Text>
      ))}
      {present.map((y) => (
        <View key={y.key} style={{ marginBottom: 6 }} wrap={false}>
          <Text style={s.bold}>
            {y.name}
            <Text style={{ fontWeight: 400, color: y.status === "cancelled" ? C.warn : C.good }}>
              {"  "}
              {y.status === "cancelled" ? "Present — cancelled (Bhanga)" : "Present"}
            </Text>
            <Text style={[s.muted, { fontWeight: 400 }]}>{y.category ? `  · ${y.category}` : ""}</Text>
          </Text>
          {y.combinations.map((c, i) => (
            <Text key={i} style={s.muted}>
              • {latin(c.claim)}
            </Text>
          ))}
          {y.cancellations.map((c, i) => (
            <Text key={i} style={{ color: C.warn }}>
              Bhanga: {latin(c)}
            </Text>
          ))}
          <Text style={s.small}>
            When active:{" "}
            {y.nabhasa ? "effective throughout life (Nabhasa yoga)" : y.windows.length ? windowsText(y.windows) : "no upcoming period of its grahas"}
          </Text>
          <RatingText rating={y.rating} label="Grahavani's classical rating: " />
          {about?.[y.key] && <AboutText text={about[y.key]} />}
        </View>
      ))}
      {present.length > 0 && !about && <AboutHint />}
      {absent.length > 0 && (
        <Text style={[s.muted, { marginTop: 4 }]}>
          <Text style={s.bold}>Not formed: </Text>
          {absent.map((a) => a.name).join(" · ")}
        </Text>
      )}
      <Text style={[s.small, { marginTop: 4 }]}>
        &quot;When active&quot;: traditionally, a yoga gives its results in the Dasha periods of the grahas that form it. Dates in IST.
      </Text>
      <Text style={s.small}>{RATING_NOTE}</Text>
    </Section>
  );
}

function PdfDoshas({ title, cards, about }: { title: string; cards: DoshaCard[]; about?: AboutTexts | null }) {
  const tone = (c: DoshaCard) =>
    c.status === "present" || c.status === "running" ? C.bad : c.status === "cancelled" || c.status === "upcoming" ? C.warn : c.status === "unavailable" ? C.muted : C.good;
  return (
    <Section title={title}>
      {cards.map((c) => (
        <View key={c.key} style={{ marginBottom: 5 }} wrap={false}>
          <Text style={s.bold}>
            {c.name}
            <Text style={{ fontWeight: 400, color: tone(c) }}>
              {"  "}
              {c.statusLabel}
            </Text>
          </Text>
          {c.details.map((d, i) => (
            <Text key={i} style={s.muted}>
              • {latin(d)}
            </Text>
          ))}
          {c.windows.length > 0 && <Text style={s.small}>Traditionally felt in: {windowsText(c.windows)}</Text>}
          {c.ranges.map((r) => (
            <Text key={r.label + r.start} style={s.small}>
              {latin(rangeText(r))}
              {r.current ? " (running now)" : ""}
            </Text>
          ))}
          {c.ranges.length > 0 && <Text style={s.small}>{"Saturn's sign changes computed by Grahavani (Lahiri), including retrograde returns."}</Text>}
          {c.rating.level && <RatingText rating={c.rating} label="" />}
          {about?.[c.key] && ABOUT_DOSHA_STATUSES.has(c.status) && <AboutText text={about[c.key]} />}
        </View>
      ))}
      {cards.some((c) => ABOUT_DOSHA_STATUSES.has(c.status)) && !about && <AboutHint />}
      {cards.some((c) => c.rating.level) && <Text style={s.small}>{RATING_NOTE}</Text>}
    </Section>
  );
}

/** "Grahavani's classical rating: Moderate. Why: …" (yogas) or "Intensity: Low. Why: …" (doshas). */
function RatingText({ rating, label }: { rating: Rating<string>; label: string }) {
  const why = rating.reasons.map((r) => latin(r)).join("; ");
  return (
    <Text style={s.small}>
      <Text style={s.bold}>{label ? `${label}${rating.level ?? "Not rated"}` : rating.label}</Text>
      {why ? `. Why: ${why}` : ""}
    </Text>
  );
}

/** Marriage (D1 and Navamsa, Darakaraka, Upapada) and career (D10) factors. */
function PdfMarriageCareer({ chart, asOf }: { chart: Chart; asOf: string }) {
  const m = marriageFactors(chart);
  const { windows, total, brief } = marriageTiming(chart, asOf);
  const d10 = careerD10(chart);
  const bt = birthTimeCheck(chart, rashi);
  return (
    <Section title="Marriage and career factors (D9 / D10)">
      {bt && (bt.sensitive.d1 || bt.sensitive.d9) && (
        <Text style={[s.small, { color: C.warn }]}>
          {[...bt.notesBy.d1, ...bt.notesBy.d9].join(" ")}{" "}
          {vargaCaveat(bt, "d9", m.d9.lagnaSign, graha)}
        </Text>
      )}
      <KeyValues
        rows={[
          ["D1 7th lord", `${grahaWithMeaning(m.d1.seventhLord)} in Bhava ${m.d1.lordHouse} (${m.d1.lordStrength})`],
          ["Venus (D1)", `${m.d1.venusDignity} (${m.d1.venusStrength})`],
          ["D9 Lagna", rashi(m.d9.lagnaSign)],
          ...(m.d9.suppressed
            ? []
            : ([["D9 7th and its lord", `${rashi(m.d9.seventhSign)}, lord ${graha(m.d9.seventhLord)} in D9 ${rashi(m.d9.lordD9Sign)}: ${dignityText(m.d9.lordD9Dignity)}${m.d9.lordVargottama ? ", Vargottama" : ""}`]] as [string, string][])),
          ["Venus (D9)", `${rashi(m.d9.venusD9Sign)}: ${dignityText(m.d9.venusD9Dignity)}`],
          ["Darakaraka", `${grahaWithMeaning(m.darakaraka.planet)} (${m.darakaraka.scheme})`],
          ["Upapada Lagna", `${rashi(m.upapada.sign)} (lord ${graha(m.upapada.lord)})`],
          ...(d10
            ? ([
                ...(bt?.sensitive.d10
                  ? [
                      [
                        "Birth time (D10)",
                        `${bt.notesBy.d10.join(" ")} ${vargaCaveat(bt, "d10", d10.lagnaSign, graha)}`,
                      ],
                    ]
                  : []),
                ["D10 Lagna", rashi(d10.lagnaSign)],
                ...(bt?.uninterpretable.d10 ? [] : ([["D10 10th and its lord", `${rashi(d10.tenthSign)}, lord ${graha(d10.tenthLord)}`]] as [string, string][])),
                ["Key planets in D10", d10.planets.map((p) => `${graha(p.name)} ${rashi(p.sign)} (${p.dignity})`).join("; ")],
              ] as [string, string][])
            : []),
        ]}
      />
      {m.comparison.map((c) => (
        <Text key={c} style={s.small}>
          • {c}
        </Text>
      ))}
      <Text style={s.h3}>Traditional timing windows{total ? ` (${total === windows.length ? total : `the first ${windows.length} of ${total}`})` : ""}</Text>
      {windows.length ? (
        windows.map((w) => (
          <Text key={w.start} style={s.small}>
            • {dateOnly(w.start)} – {dateOnly(w.end)}: {w.period.split("–").map(graha).join("–")} (
            {w.rank === "MD and AD" ? "both Dasha lords are significators" : "Antardasha lord is a significator"}). {w.why.join("; ")}
            {w.moonAlso ? "; also from the Moon" : ""}
            {w.secondary.length ? `; also ${w.secondary.join(", ")}` : ""}.
          </Text>
        ))
      ) : (
        <Text style={s.small}>No double transit falls in a significator&apos;s Antardasha over the current and next Mahadasha.</Text>
      )}
      <Text style={s.small}>
        A window is an Antardasha whose lord is a marriage significator while Jupiter and Saturn both occupy or aspect the same target from the Lagna (the 7th house, or the sign the 7th lord occupies). Overlaps shorter than {MIN_WINDOW_DAYS} days are left out
        {brief.length ? ` (${brief.length} here: ${brief.map((w) => `${dateOnly(w.start)} – ${dateOnly(w.end)}`).join("; ")})` : ""}. Windows are not ranked beyond whether
        both Dasha lords are significators. Traditional indicators only.
      </Text>
    </Section>
  );
}

function AboutText({ text }: { text: string }) {
  return (
    <Text style={[s.small, { marginTop: 2, color: C.fg }]}>
      <Text style={s.bold}>About: </Text>
      {latin(text)}
    </Text>
  );
}

function AboutHint() {
  return <Text style={[s.small, { marginTop: 2 }]}>Open &quot;About&quot; on the Grahavani page to add short AI-written descriptions here.</Text>;
}
