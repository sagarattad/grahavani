// Synthetic births chosen for specific rules (saved with scripts/save-fixture.mjs,
// Delhi 28.6139 N, 77.209 E):
// - 2026-04-20 14:30: Simha Lagna, Mars in Meena (8th) — Manglik with the Simha yogakaraka exemption.
// - 2026-10-02 09:30: Tula Lagna, Moon alone in Vrishabha (8th) — Kemadruma formed and not cancelled.
// - 2026-10-10 00:45: Karka Lagna, Jupiter exalted in the 1st — Hamsa (Pancha Mahapurusha).
import { describe, expect, it } from "vitest";
import { computeManglik } from "./manglik";
import { kemadruma } from "./rules";
import { groupYogas } from "../yogas";
import { kemadrumaCard, manglikCard } from "../doshas";
import { loadKundliFixtures } from "../../tests/fixtures";

const fx = loadKundliFixtures();
const chartOf = (part: string) => fx.find((f) => f.file.includes(part))?.chart;

describe.skipIf(!chartOf("2026-04-20-delhi-leo"))("Simha Lagna Manglik", () => {
  const c = chartOf("2026-04-20-delhi-leo")!;

  it("Mars 8th from the Lagna; the yogakaraka exemption applies and cancels it, with reasoning", () => {
    expect(c.lagna.sign_num).toBe(5);
    const m = computeManglik(c);
    expect(m.grahavani.refs[0]).toMatchObject({ from: "Lagna", house: 8, north: true });
    expect(m.grahavani.cancellations.find((x) => x.text === "Mars yogakaraka (Karka/Simha Lagna exemption)")!.applies).toBe(true);
    expect(m.severity).toBe("cancelled");
    expect(m.grahavani.steps.join(" | ")).toMatch(/Mars yogakaraka \(Karka\/Simha Lagna exemption\) → −1 .*Formed but cancelled/);
    expect(manglikCard(c, c.vimshottari.current.as_of)).toMatchObject({ status: "cancelled", statusLabel: "Formed but cancelled" });
  });
});

describe.skipIf(!chartOf("2026-10-02-delhi-kemadruma"))("uncancelled Kemadruma", () => {
  const c = chartOf("2026-10-02-delhi-kemadruma")!;

  it("formed, and none of the cancellations apply", () => {
    expect(kemadruma(c)).toMatchObject({ state: "formed", cancellations: [] });
    const card = kemadrumaCard(c, c.vimshottari.current.as_of);
    expect(card).toMatchObject({ status: "present", statusLabel: "Formed" });
    expect(card.rating.level).toBe("Medium");
  });

  it("Kundlit agrees (Kemadruma listed, no Bhanga)", () => {
    expect(c.yogas.some((y) => y.rule_id === "yoga.kemadruma")).toBe(true);
    expect(c.yogas.some((y) => y.rule_id === "yoga.bhanga.kemadruma")).toBe(false);
  });
});

describe.skipIf(!chartOf("2026-10-10-delhi-hamsa"))("Pancha Mahapurusha: Hamsa", () => {
  const c = chartOf("2026-10-10-delhi-hamsa")!;

  it("Jupiter exalted in a kendra forms Hamsa, rated from Jupiter's strength", () => {
    const jup = c.grahas.find((g) => g.name === "Jupiter")!;
    expect(jup.dignity).toBe("exalted");
    expect([1, 4, 7, 10]).toContain(jup.house);
    const h = groupYogas(c, c.vimshottari.current.as_of).find((y) => y.key === "yoga.hamsa")!;
    expect(h.status).toBe("present");
    expect(h.rating.level).toBe("Strong");
    expect(h.rating.reasons[0]).toMatch(/Pancha Mahapurusha conditions met/);
  });
});
