// The three PDF documents. They take plain data (no database access), so tests
// can render them straight from the Kundlit fixtures.
import { Text, View } from "@react-pdf/renderer";
import { d1Houses, d9Houses } from "../chart/northIndian";
import {
  KOOTS,
  cancellationLabel,
  dignity,
  graha,
  grahaWithMeaning,
  kootLabel,
  nakshatra,
  rashi,
  severity,
  verdict,
} from "../glossary";
import { birthDateTime, dateOnly, dms, points, ymd } from "../format";
import { nearNakshatraBoundary, nearSignBoundary } from "../accuracy";
import { MANGLIK_CHECKS, comparedText, doshaState, manglikCombined, manglikStatus, sortKoots } from "../summaries";
import { yogaChecklist } from "../yogas";
import { windowText } from "../periods";
import type { DoshaCard } from "../doshas";
import { ABOUT_DOSHA_STATUSES, type AboutTexts } from "../ai/about";
import { PARTIAL_POINTS_NOTE, RATING_NOTE, rateKootDosha, type Rating } from "../strength";
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
  ].filter(Boolean) as string[];

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
            ["Graha", 2.2],
            ["Rashi (sign)", 1.4],
            ["Degree", 1],
            ["Nakshatra-Pada", 2],
            ["Bhava (house)", 1.1, "center"],
            ["R", 0.4, "center"],
            ["C", 0.4, "center"],
            ["Avastha", 1, "center"],
          ]}
          rows={[
            ["Lagna", rashi(chart.lagna.sign_num), dms(chart.lagna.deg_in_sign), `${nakshatra(chart.lagna.nakshatra_num)}-${chart.lagna.pada}`, "1", "", "", ""],
            ...chart.grahas.map((g) => [
              grahaWithMeaning(g.name) + (g.dignity !== "neutral" ? ` · ${dignity(g.dignity)}` : ""),
              rashi(g.sign_num),
              dms(g.deg_in_sign),
              `${nakshatra(g.nakshatra_num)}-${g.pada}`,
              String(g.house),
              g.retrograde ? "R" : "",
              g.combust ? "C" : "",
              g.avastha ?? "-",
            ]),
          ]}
        />
        <Text style={[s.small, { marginTop: 4 }]}>R = Vakri (retrograde). C = Asta (combust). Rahu and Ketu always move in reverse. Avastha = Baladi avastha (age state).</Text>
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
          ]}
        />
      </Section>

      <Section title="Vimshottari Dasha (120-year period system)">
        <Text style={s.h3}>Running now</Text>
        <KeyValues
          rows={[
            ["Mahadasha (major period)", `${grahaWithMeaning(dasha.mahadasha.lord)} · ends ${dateOnly(dasha.mahadasha.end)}`],
            ["Antardasha (sub-period)", `${grahaWithMeaning(dasha.antardasha.lord)} · ends ${dateOnly(dasha.antardasha.end)}`],
            ["Pratyantar Dasha", `${grahaWithMeaning(dasha.pratyantardasha.lord)} · ends ${dateOnly(dasha.pratyantardasha.end)}`],
          ]}
        />
        <Text style={[s.small, { marginTop: 3 }]}>
          Dasha balance at birth: {graha(chart.vimshottari.birth.mahadasha.lord)} Mahadasha, {ymd(chart.vimshottari.birth.mahadasha.balance_ymd)}. As of{" "}
          {dateOnly(dasha.as_of)}.
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

      <PdfYogas chart={chart} asOf={dasha.as_of} about={about} />
      <PdfDoshas title="Doshas" cards={doshas} about={about} />

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
            {y.nabhasa ? "effective throughout life (Nabhasa yoga)" : y.windows.length ? y.windows.map(windowText).join("; ") : "no upcoming period of its grahas"}
          </Text>
          <RatingText rating={y.rating} label="Grahavani's classical rating: " />
          {about?.[y.key] && <AboutText text={about[y.key]} />}
        </View>
      ))}
      {present.length > 0 && !about && <AboutHint />}
      {absent.length > 0 && (
        <Text style={[s.muted, { marginTop: 4 }]}>
          <Text style={s.bold}>Not present: </Text>
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
          {c.windows.length > 0 && <Text style={s.small}>Traditionally felt in: {c.windows.map(windowText).join("; ")}</Text>}
          {c.ranges.map((r) => (
            <Text key={r.label + r.start} style={s.small}>
              {r.label}: {dateOnly(r.start)} – {dateOnly(r.end)}
              {r.current ? " (running now)" : ""}
            </Text>
          ))}
          {c.coveredUntil && (
            <Text style={s.small}>Kundlit lists Shani transit periods that end by {dateOnly(c.coveredUntil)}; one that ends later is not shown.</Text>
          )}
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
  const why = rating.reasons.map((r) => latin(r.replace(/−/g, "-"))).join("; ");
  return (
    <Text style={s.small}>
      <Text style={s.bold}>{label ? `${label}${rating.level ?? "Not rated"}` : rating.label}</Text>
      {why ? `. Why: ${why}` : ""}
    </Text>
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
