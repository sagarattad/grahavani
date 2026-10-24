// Timing candidates for follow-up questions, chosen in code so the model never
// derives significators or dates itself. For each topic: the traditional
// significators of that topic in this chart, then the upcoming Antardashas
// (current and next Mahadasha) ruled by one of them. The model only ranks
// and explains these.
import { antardashas, contains, type Period } from "./dasha";
import { graha } from "./glossary";
import { dateOnly } from "./format";
import type { Chart } from "./kundlit-schemas";

export const TIMING_TOPICS = ["marriage", "career", "education", "property", "travel"] as const;
export type TimingTopic = (typeof TIMING_TOPICS)[number];

type Rule = { lords?: number[]; natural?: string[]; occupants?: number[] };
const RULES: Record<TimingTopic, Rule> = {
  marriage: { lords: [7], natural: ["Venus", "Jupiter", "Rahu"], occupants: [7] },
  career: { lords: [10], natural: ["Saturn", "Sun"] },
  education: { lords: [4, 5], natural: ["Mercury", "Jupiter"] },
  property: { lords: [4], natural: ["Mars", "Venus"] },
  travel: { lords: [9, 12], natural: ["Rahu"] },
};

export type TimingCandidate = { mahadasha: string; antardasha: string; from: string; to: string; reason: string };

/** Significator graha (Kundlit name) → why it signifies the topic in this chart. */
export function significators(chart: Chart, topic: TimingTopic): Map<string, string[]> {
  const rule = RULES[topic];
  const why = new Map<string, string[]>();
  const add = (g: string, r: string) => why.set(g, [...(why.get(g) ?? []), r]);
  for (const h of rule.lords ?? []) {
    const lord = chart.functional.house_lords[String(h)];
    if (lord) add(lord, `lord of Bhava ${h}`);
  }
  for (const g of rule.natural ?? []) add(g, `natural significator of ${topic}`);
  for (const h of rule.occupants ?? []) {
    for (const g of chart.grahas.filter((x) => x.house === h)) add(g.name, `placed in Bhava ${h}`);
  }
  return why;
}

export function timingCandidates(chart: Chart, asOf: string, perTopic = 6): Record<TimingTopic, TimingCandidate[]> {
  const { timeline } = chart.vimshottari;
  const now = new Date(asOf).getTime();
  const i = Math.max(
    timeline.findIndex((p) => contains(p, now)),
    0,
  );
  const mds: Period[] = timeline.slice(i, i + 2);
  const out = {} as Record<TimingTopic, TimingCandidate[]>;
  for (const topic of TIMING_TOPICS) {
    const sig = significators(chart, topic);
    out[topic] = mds
      .flatMap((md) =>
        antardashas(md, timeline)
          .filter((ad) => new Date(ad.end).getTime() > now && sig.has(ad.lord))
          .map((ad) => {
            const reasons = [`Antardasha lord ${graha(ad.lord)}: ${sig.get(ad.lord)!.join(", ")}`];
            if (sig.has(md.lord)) reasons.push(`Mahadasha lord ${graha(md.lord)}: ${sig.get(md.lord)!.join(", ")}`);
            return { mahadasha: graha(md.lord), antardasha: graha(ad.lord), from: dateOnly(ad.start), to: dateOnly(ad.end), reason: reasons.join("; ") };
          }),
      )
      .slice(0, perTopic);
  }
  return out;
}
