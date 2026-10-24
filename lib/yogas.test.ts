import { describe, expect, it } from "vitest";
import { groupYogas, yogaChecklist } from "./yogas";
import { YOGA_CHECKLIST } from "./glossary";
import { loadKundliFixtures, rawFixture } from "../tests/fixtures";

const fx = loadKundliFixtures();
const chartOf = (part: string) => fx.find((f) => f.file.includes(part))!.chart;
const raipur = chartOf("raipur");
const asOf = raipur.vimshottari.current.as_of;

describe("groupYogas", () => {
  const groups = groupYogas(raipur, asOf);
  const by = (k: string) => groups.find((g) => g.key === k)!;

  it("merges repeated entries under one yoga", () => {
    expect(by("yoga.raja").combinations).toHaveLength(2);
    expect(by("yoga.dhana").combinations).toHaveLength(3);
    expect(groups.filter((g) => g.key === "yoga.raja")).toHaveLength(1);
  });

  it("attaches Bhanga entries as a cancellation of their yoga", () => {
    const r = by("yoga.ruchaka");
    expect(r.status).toBe("cancelled");
    expect(r.cancellations[0]).toMatch(/Saturn in 8H/);
    expect(groups.some((g) => g.key.startsWith("yoga.bhanga."))).toBe(false);
  });

  it("gives activation windows from the participants' Dasha periods (none for Nabhasa)", () => {
    const dhana = by("yoga.dhana");
    for (const w of dhana.windows) expect(dhana.participants).toContain(w.ad ?? w.md);
    expect(by("nabhasa.pasha").windows).toEqual([]);
  });

  it("never lists Kemadruma (it is shown as a dosha)", () => {
    const mumbai = chartOf("mumbai");
    expect(mumbai.yogas.some((y) => y.rule_id === "yoga.kemadruma")).toBe(true);
    expect(groupYogas(mumbai, asOf).some((g) => g.key === "yoga.kemadruma")).toBe(false);
  });
});

describe("yogaChecklist", () => {
  it("marks unformed checklist yogas as absent and keeps extras like Pasha", () => {
    const { present, absent } = yogaChecklist(raipur, asOf);
    expect(absent.map((a) => a.name)).toContain("Bhadra");
    expect(present.map((p) => p.name)).toContain("Pasha");
    expect(absent.some((a) => present.some((p) => p.key === a.key))).toBe(false);
  });

  it("every checklist yoga has appeared in at least one real Kundlit response", () => {
    const seen = new Set(fx.flatMap((f) => (rawFixture(f.file).chart.yogas as { rule_id: string }[]).map((y) => y.rule_id)));
    for (const c of YOGA_CHECKLIST) expect(seen, c.ruleId).toContain(c.ruleId);
  });
});

describe("charts cached before rule ids were stored", () => {
  it("still group and match the checklist by name", () => {
    const old = { ...raipur, yogas: raipur.yogas.map((y) => ({ ...y, rule_id: undefined })) };
    const { present, absent } = yogaChecklist(old, asOf);
    expect(present.find((p) => p.name === "Raj Yoga")!.combinations).toHaveLength(2);
    expect(present.find((p) => p.name === "Ruchaka")!.status).toBe("cancelled");
    expect(absent.map((a) => a.name)).not.toContain("Raj Yoga");
  });
});
