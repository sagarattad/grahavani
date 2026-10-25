import { describe, expect, it } from "vitest";
import { aboutFacts, aboutItemsForChart, milanAboutFacts, milanAboutItems, validateAbout } from "./about";
import { sha256, stableStringify } from "../ids";
import { loadKaalSarpFixtures, loadKundliFixtures, loadManglikFixtures, loadMilanFixtures } from "../../tests/fixtures";

const fx = loadKundliFixtures();
const raipur = fx.find((f) => f.file.includes("raipur"))!.chart;
const [manglik] = loadManglikFixtures();
const kaalSarp = loadKaalSarpFixtures().find((k) => k.file.includes("absent"))!;
const items = aboutItemsForChart(raipur, { manglik, kaalSarp });
const { facts, ctx } = aboutFacts(raipur, items);
const keys = items.map((i) => i.key);

const good = () => ({
  items: keys.map((key) => ({ key, about: "Traditionally this combination is linked with steady effort. Mangal in Vrishchika in the 7th house adds drive." })),
});

describe("About items", () => {
  it("lists exactly the present Yogas and Doshas", () => {
    // Kemadruma is formed but cancelled (Grahavani's rule), so it counts as present.
    expect(keys.sort()).toEqual(["dhaiya", "kemadruma", "manglik", "nabhasa.pasha", "yoga.adhi", "yoga.dhana", "yoga.raja", "yoga.ruchaka", "yoga.vasi"].sort());
  });

  it("skips absent doshas and absent checklist yogas", () => {
    expect(keys).not.toContain("kaalSarp");
    expect(keys).not.toContain("sadeSati");
    expect(keys).not.toContain("yoga.bhadra");
  });

  it("keeps cancellations separate from details", () => {
    const m = items.find((i) => i.key === "manglik")!;
    expect(m.cancellations).toEqual(["Mars in its own or exaltation sign (tradition-dependent)"]);
    expect(m.details.join()).not.toMatch(/Cancellation/);
  });

  it("a running transit dosha names its phase, without dates", () => {
    expect(items.find((i) => i.key === "dhaiya")!.details).toEqual(["Running phase: Ardhashtama (8th from Chandra)"]);
  });

  it("FACTS contain no dates, names or birth details", () => {
    const s = JSON.stringify(facts);
    expect(s).not.toMatch(/\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}/);
    expect(s).not.toMatch(/\b(19|20)\d{2}-\d{2}-\d{2}/);
    expect(s).not.toMatch(/Raipur|14:30|latitude/);
  });

  it("the cache hash is stable across calls", () => {
    const again = aboutFacts(raipur, aboutItemsForChart(raipur, { manglik, kaalSarp })).facts;
    expect(sha256(stableStringify(again))).toBe(sha256(stableStringify(facts)));
  });
});

describe("validateAbout", () => {
  it("accepts a correct output", () => {
    expect(validateAbout(good(), keys, ctx)).toEqual([]);
  });

  it("rejects missing or extra keys", () => {
    const out = good();
    out.items.pop();
    expect(validateAbout(out, keys, ctx).join()).toMatch(/Missing/);
    const extra = good();
    extra.items.push({ key: "yoga.hamsa", about: "Calm text." });
    expect(validateAbout(extra, keys, ctx).join()).toMatch(/Unexpected/);
  });

  it("rejects dates, wrong placements and remedies", () => {
    const withDate = good();
    withDate.items[0].about = "It peaks around 2031.";
    expect(validateAbout(withDate, keys, ctx).join()).toMatch(/2031/);

    const wrong = good();
    wrong.items[0].about = "Mars in Mesha brings drive.";
    expect(validateAbout(wrong, keys, ctx).join()).toMatch(/Mars in Mesha/);

    const remedy = good();
    remedy.items[0].about = "A puja on Tuesdays is traditionally advised.";
    expect(validateAbout(remedy, keys, ctx).join()).toMatch(/remedy/);
  });
});

describe("Gun Milan About items", () => {
  it("Nadi Dosha when present, with its cancellation; nothing when there is no dosha", () => {
    const cancelled = loadMilanFixtures().find((f) => f.file.includes("nadi-cancelled"))!;
    const it1 = milanAboutItems(cancelled);
    expect(it1.map((i) => i.key)).toEqual(["nadiDosha"]);
    expect(it1[0].cancellations[0]).toMatch(/Same Rashi/);

    const none = loadMilanFixtures().find((f) => f.file.includes("spec-couple"))!;
    expect(milanAboutItems(none)).toEqual([]);
  });

  it("milan FACTS only use the two Moons for placements", () => {
    const m = loadMilanFixtures().find((f) => f.file.includes("bhakoot-cancelled"))!;
    const { facts: mf, ctx: mctx } = milanAboutFacts(fx[0].chart, fx[1].chart, milanAboutItems(m));
    expect(mf.items.map((i) => i.key).sort()).toEqual(["bhakootDosha", "nadiDosha"]);
    expect(mctx.placements).toHaveLength(2);
  });
});

describe("About ratings", () => {
  it("items carry the fixed rating phrase and reasons", () => {
    const ruchaka = items.find((i) => i.key === "yoga.ruchaka")!;
    expect(ruchaka.rating).toBe("rated Moderate"); // Mars strong, one level lower for the Bhanga
    expect(ruchaka.rating_reasons.join()).toMatch(/Bhanga/);
    expect(items.find((i) => i.key === "manglik")!.rating).toBe("intensity: Medium"); // 7th from Lagna, 4th from Moon, own sign −1
    expect(items.find((i) => i.key === "nabhasa.pasha")!.rating).toBe("not rated");
  });

  it("each text may state only its own item's rating", () => {
    const out = good();
    out.items.find((i) => i.key === "yoga.raja")!.about += " In this chart it is rated Moderate.";
    expect(validateAbout(out, keys, ctx, items)).toEqual([]);
    out.items.find((i) => i.key === "yoga.raja")!.about += " It is rated Strong.";
    expect(validateAbout(out, keys, ctx, items).join()).toMatch(/yoga.raja.*rated Strong.*computed rated Moderate/);
  });

  it("rejects calling the rating Shadbala", () => {
    const out = good();
    out.items[0].about += " Its Shadbala rating is Weak.";
    expect(validateAbout(out, keys, ctx, items).join()).toMatch(/Shadbala/);
  });

  it("Gun Milan Nadi / Bhakoot items carry their intensity", () => {
    const milan = loadMilanFixtures().find((f) => f.file.includes("nadi-cancelled"))!;
    expect(milanAboutItems(milan).find((i) => i.key === "nadiDosha")!.rating).toBe("intensity: Low");
  });
});
