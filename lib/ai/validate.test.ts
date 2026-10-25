import { describe, expect, it } from "vitest";
import { checkDates, isStyleProblem, validateReading } from "./validate";
import { kundliFacts, manglikFacts, milanFacts } from "./facts";
import { refusalTopic } from "./refusal";
import { loadKaalSarpFixtures, loadKundliFixtures, loadManglikFixtures, loadMilanFixtures } from "../../tests/fixtures";

const raipur = loadKundliFixtures().find((f) => f.file.includes("raipur"))!.chart;
const [manglikFx] = loadManglikFixtures();
const kaalSarpFx = loadKaalSarpFixtures().find((k) => k.file.includes("absent"))!;
const extras = { manglik: manglikFx, kaalSarp: kaalSarpFx, birthDate: "1990-01-15" };
const { ctx: kundliCtx, facts } = kundliFacts(raipur, raipur.vimshottari.current, extras);
const followup = kundliFacts(raipur, raipur.vimshottari.current, extras, true);
/** Raipur's D9 / D10 Lagna are birth-time sensitive; tests about other rules leave the caveat rule out. */
const placementCtx = { ...kundliCtx, birthTimeSensitive: undefined };

const kundliOut = (text: string) => ({
  personality: text,
  career: "ok",
  marriage: "ok",
  health_wellbeing: "ok",
  current_dasha: "ok",
  yogas: "ok",
  doshas: "ok",
  summary: "ok",
});

describe("facts", () => {
  it("never contains names, places or birth details", () => {
    for (const f of [facts, followup.facts]) {
      expect(JSON.stringify(f)).not.toMatch(/Raipur|1990-01-15|15 Jan 1990|14:30|latitude|longitude/);
    }
  });

  it("never contains remedies", () => {
    expect(JSON.stringify(followup.facts)).not.toMatch(/remed|Hanuman|lentils|peepal/i);
  });

  it("reading facts carry Saturn transit overlaps but not the transit dosha cards or timing candidates", () => {
    expect(facts).not.toHaveProperty("timing_candidates");
    expect((facts.doshas as { dosha: string }[]).map((d) => d.dosha)).not.toContain("Sade Sati");
    expect(facts.transits).toHaveProperty("saturn_overlaps");
    expect(followup.facts).toHaveProperty("timing_candidates");
    expect(JSON.stringify(followup.facts)).toMatch(/Sade Sati/);
  });

  it("carry Grahavani's factors: dignity, strength, functional nature, D9 / D10, Dasha lords; no method fields", () => {
    expect(facts.functional_nature.yogakarakas).toEqual(["Shani"]); // Vrishabha Lagna
    expect(facts.marriage).toHaveProperty("darakaraka");
    expect(facts.marriage.upapada_lagna).toHaveProperty("rashi");
    expect(facts).toHaveProperty("career_d10");
    expect(facts.dasha_lords.mahadasha.reading.length).toBeGreaterThan(0);
    expect(facts).not.toHaveProperty("not_computed");
    expect(facts).not.toHaveProperty("rating_basis");
    expect(facts.marriage).toHaveProperty("timing_windows");
    expect(facts.transits).toHaveProperty("jupiter_next");
    expect(facts.transits).not.toHaveProperty("jupiter_transits");
    expect(JSON.stringify(facts.grahas)).toMatch(/"strength":"(strong|moderate|weak)"/);
  });

  it("groups yogas in facts (one Raj Yoga entry with 2 combinations)", () => {
    const raj = facts.yogas_present.filter((y) => y.yoga === "Raj Yoga");
    expect(raj).toHaveLength(1);
    expect(raj[0].combinations).toHaveLength(2);
  });
});

describe("Kundli validation", () => {
  it("accepts correct placements in English and Sanskrit", () => {
    const text =
      "Mangal (Mars) is placed in Vrishchika, its own sign. Mars sits in the 7th house. " +
      "Guru in Mithuna adds learning. Chandra is in the fourth bhava. In your Navamsa, Mars in Kumbha shows...";
    expect(validateReading(kundliOut(text), placementCtx)).toEqual([]);
  });

  it("rejects a Rashi that is not in the facts", () => {
    expect(validateReading(kundliOut("Mars in Mesha makes you bold."), kundliCtx)).toHaveLength(1);
  });

  it("rejects a wrong Bhava", () => {
    expect(validateReading(kundliOut("Surya in the 1st house gives confidence."), kundliCtx)).toHaveLength(1);
  });

  it("does not accept a D9 placement unless the sentence mentions Navamsa", () => {
    expect(validateReading(kundliOut("Mars in Kumbha brings ideas."), kundliCtx)).toHaveLength(1);
  });

  it("checks Dasha lords", () => {
    expect(validateReading(kundliOut("You are in Rahu Mahadasha with Shani Antardasha."), kundliCtx)).toEqual([]);
    expect(validateReading(kundliOut("This is Guru Pratyantar Dasha."), kundliCtx)).toHaveLength(1);
  });

  it("ignores general numbers", () => {
    expect(validateReading(kundliOut("There are 12 houses, 9 grahas and 27 Nakshatras."), kundliCtx)).toEqual([]);
  });
});

describe("dates must come from FACTS", () => {
  const cand = followup.facts.timing_candidates!.marriage[0];

  it("accepts an exact timing-candidate date and its year", () => {
    const text = `A favourable window is ${cand.from} to ${cand.to}, traditionally considered favourable.`;
    expect(validateReading({ answer: text, out_of_scope: false }, followup.ctx)).toEqual([]);
    expect(checkDates(`Around ${cand.from.split(" ")[2]}.`, followup.ctx.allowedDates!)).toEqual([]);
  });

  it("rejects an invented date, month or year", () => {
    expect(checkDates("Marriage is likely on 3 Mar 2031.", followup.ctx.allowedDates!)).toHaveLength(1);
    expect(checkDates("Around 2099 things change.", followup.ctx.allowedDates!)).toHaveLength(1);
  });

  it("allows the birth date even though FACTS never contains it", () => {
    expect(checkDates("Born on 15 Jan 1990.", kundliCtx.allowedDates!)).toEqual([]);
  });
});

describe("refusal guard", () => {
  it("catches refused topics before any model call", () => {
    expect(refusalTopic("When will I get divorced?")).toBe("divorce or separation");
    expect(refusalTopic("Will I have a child after marriage?")).toBe("childbirth or fertility");
    expect(refusalTopic("When will I die?")).toBe("death or lifespan");
    expect(refusalTopic("Will I win my court case?")).toBe("legal cases");
  });

  it("lets normal questions through", () => {
    expect(refusalTopic("When is marriage likely?")).toBeNull();
    expect(refusalTopic("Which career suits me?")).toBeNull();
    expect(refusalTopic("What does my current Dasha mean for studies?")).toBeNull();
  });
});

describe("Milan validation", () => {
  const milan = loadMilanFixtures().find((f) => f.file.includes("spec-couple"))!;
  const [m1, m2] = loadManglikFixtures();
  const kundlis = loadKundliFixtures();
  const { ctx } = milanFacts(
    milan,
    { chart: kundlis[0].chart, manglik: m1, kaalSarp: null },
    { chart: kundlis[1].chart, manglik: m2, kaalSarp: null },
  );

  const good = () => ({
    overall: "You scored 19 out of 36. Traditionally, 18 or more out of 36 is considered acceptable.",
    koots: milan.koots.map((k) => ({ koot: k.koot === "Vasya" ? "Vashya" : k.koot, earned: k.earned, max: k.max_points, explanation: "..." })),
    doshas_and_cancellations: "Nadi earned 8/8, so there is no Nadi Dosha. Gana scored 1 point.",
    manglik_both: "The Groom is Manglik and the Bride is not.",
    summary: "There are 8 koots in total.",
  });

  it("accepts correct values", () => {
    expect(validateReading(good(), ctx)).toEqual([]);
  });

  it("rejects wrong structured koot points", () => {
    const out = good();
    out.koots[7].earned = 0;
    expect(validateReading(out, ctx).join()).toMatch(/Nadi/);
  });

  it("rejects wrong koot points in text", () => {
    const out = good();
    out.doshas_and_cancellations = "Nadi earned 0/8, which is Nadi Dosha.";
    expect(validateReading(out, ctx)).toHaveLength(1);
  });

  it("rejects a wrong total", () => {
    const out = good();
    out.overall = "Your Gun Milan score is 27 / 36.";
    expect(validateReading(out, ctx)).toHaveLength(1);
  });
});

describe("Manglik validation", () => {
  it("accepts D1 placements only", () => {
    const { ctx } = manglikFacts(manglikFx, raipur);
    expect(validateReading({ status: "Mangal in Vrishchika in the 7th house." }, ctx)).toEqual([]);
    expect(validateReading({ status: "Mangal in Mesha." }, ctx)).toHaveLength(1);
  });
});

describe("ratings in fixed phrases", () => {
  // Raipur: Raj Yoga rated Moderate, Dhana Yoga Weak, Manglik Dosha of Low intensity.
  const check = (text: string) => validateReading({ yogas: text }, kundliCtx);

  it("facts carry the fixed rating phrase", () => {
    const raj = (facts.yogas_present as { yoga: string; rating: string }[]).find((y) => y.yoga === "Raj Yoga")!;
    expect(raj.rating).toBe("rated Moderate");
    expect(JSON.stringify(facts.doshas)).toMatch(/"rating":"Low intensity"/);
    expect(JSON.stringify(facts.grahas)).toMatch(/"avastha":"Bala \(minor factor\)"/);
  });

  it("a yoga's rating must match FACTS", () => {
    expect(check("Your Raj Yoga is rated Moderate here.")).toEqual([]);
    expect(check("Your Raj Yoga is rated Strong here.").join()).toMatch(/Raj Yoga: text says "rated Strong", computed rated Moderate/);
  });

  it("a dosha's intensity must match FACTS", () => {
    expect(check("Manglik Dosha, of Low intensity, has one cancellation.")).toEqual([]);
    expect(check("Manglik Dosha is of High intensity.").join()).toMatch(/computed Low intensity/);
    // The old colon form is rejected in every construction (rule R1).
    for (const t of ["Manglik Dosha, intensity: Medium.", "Manglik Dosha carries intensity: Medium.", "Manglik Dosha has intensity: Medium.", "Its intensity is: Medium."])
      expect(check(t).join(), t).toMatch(/write "Medium intensity"/);
  });

  it("other uses of strong, weak, high or low are ignored", () => {
    expect(check("Raj Yoga gives a strong sense of duty and high standards; low moods pass quickly.")).toEqual([]);
  });

  it("a longer name is not mistaken for a shorter one", () => {
    // Raipur has no Neechabhanga Raj Yoga, so this sentence names no rated item.
    expect(check("Neechabhanga Raj Yoga is rated Moderate.").join()).toMatch(/neechabhanga raj: .*computed no rating/);
  });

  it("a fixed phrase shared by items with different ratings, or naming none, is rejected", () => {
    expect(check("Raj Yoga and Dhana Yoga are rated Moderate.").join()).toMatch(/clearly belong to one/);
    // Shared by items that all have that rating (a live failure).
    expect(check("Its Raj Yoga is rated Moderate; its Dhana Yoga and Vasi are each rated Weak.")).toEqual([]);
    expect(check("It is rated Moderate.").join()).toMatch(/clearly belong to one/);
  });

  it("several items in one sentence: each phrase follows its own item's name", () => {
    expect(check("Raj Yoga is rated Moderate, while Vasi is rated Weak.")).toEqual([]);
    expect(check("Raj Yoga is rated Moderate, while Ruchaka is rated Strong.").join()).toMatch(/Ruchaka: text says "rated Strong"/);
    expect(check("Manglik Dosha is of Low intensity and Raj Yoga is rated Moderate.")).toEqual([]);
    // The phrase's own clause names one item (a live failure).
    expect(check("Ruchaka has Bhanga cancellation, Manglik Dosha remains of Low intensity.")).toEqual([]);
    expect(check("Ruchaka has Bhanga cancellation, Manglik Dosha remains of High intensity.").join()).toMatch(/computed Low intensity/);
  });

  it("a rating can refer back to the item named just before (the live failures)", () => {
    expect(check("Manglik Dosha is present. It is of Low intensity.")).toEqual([]);
    expect(check("Manglik Dosha is present; Low intensity.")).toEqual([]);
    expect(check("Raj Yoga links the 1st and 5th lords. It is rated Moderate because of combustion.")).toEqual([]);
    expect(check("Manglik Dosha is present. It is of High intensity.").join()).toMatch(/computed Low intensity/);
  });

  it("hyphen and space spellings are the same name", () => {
    const f = followup.ctx; // Raipur
    expect(validateReading({ answer: "Raj-Yoga is rated Moderate." }, f)).toEqual([]);
  });

  it("never presents the rating as Shadbala", () => {
    expect(check("This Shadbala rating is Strong.").join()).toMatch(/Shadbala/);
    expect(check("Shadbala is not part of this report.")).toEqual([]);
  });

  it('follow-up "What is my Shadbala?": the expected answer passes', () => {
    const answer = {
      answer:
        "Shadbala is not calculated in this report. Grahavani's classical rating, shown with each Yoga and Dosha, is a different, simpler measure. For example, your Raj Yoga is rated Moderate.",
      out_of_scope: false,
    };
    expect(validateReading(answer, followup.ctx)).toEqual([]);
  });
});

describe("evidence rules (Oct 2026 review)", () => {
  const check = (text: string) => validateReading({ career: text }, placementCtx);

  it("rejects absolute negative verdicts", () => {
    expect(check("Venus gives very little result.").join()).toMatch(/absolute negative/);
    expect(check("There will be marked difficulties in partnerships.").join()).toMatch(/absolute negative/);
    expect(check("Marriage will never be easy.").join()).toMatch(/absolute negative/);
    expect(check("Venus is weak, but the debility is cancelled.")).toEqual([]);
  });

  it("accepts D10 placements when the sentence names the D10", () => {
    const sun = raipur.grahas.find((g) => g.name === "Sun")!;
    const d10 = { 1: "Mesha", 2: "Vrishabha", 3: "Mithuna", 4: "Karka", 5: "Simha", 6: "Kanya", 7: "Tula", 8: "Vrishchika", 9: "Dhanu", 10: "Makara", 11: "Kumbha", 12: "Meena" }[sun.dashamsha!.sign_num];
    expect(check(`In the D10, Surya is in ${d10}.`)).toEqual([]);
    // The D10 named in the previous sentence carries through its paragraph (a live failure), not into the next one.
    expect(check(`The D10 career chart is read next. Surya in ${d10} supports authority.`)).toEqual([]);
    expect(check(`The D10 career chart is read next.\n\nSurya in ${d10} supports authority.`).join()).toMatch(/not in the computed facts/);
    expect(check(`The D10 career chart is read next. In the birth chart, Surya in ${d10} supports authority.`).join()).toMatch(/not in the computed facts/);
  });

  it("allows naming partial Shadbala components", () => {
    expect(check("The partial Shadbala components for Surya include Uccha and Dig bala.")).toEqual([]);
  });

  it("a Dig bala claim must match the planet's listed strength factors", () => {
    const listed = kundliCtx.digBalaFactor!;
    const all = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
    const unlisted = all.find((p) => !listed.includes(p))!;
    expect(check(`${unlisted} has low directional strength.`).join()).toMatch(/Dig bala that is not among/);
    if (listed.length) expect(check(`${listed[0]} has low directional strength.`)).toEqual([]);
  });

  it("a planet's dignity word must be its compound dignity (rule D1)", () => {
    const sun = kundliCtx.dignities!.Sun.d1!;
    const wrong = ["great friend", "friend", "neutral", "enemy", "great enemy"].find((w) => w !== sun)!;
    expect(check(`Surya is in a ${wrong}'s sign.`).join()).toMatch(/its dignity is/);
    if (["great friend", "friend", "neutral", "enemy", "great enemy"].includes(sun)) expect(check(`Surya is in a ${sun}'s sign.`)).toEqual([]);
    // A D10 claim is checked against the D10 dignity.
    const d10 = kundliCtx.dignities!.Saturn.d10!;
    if (["great friend", "friend", "neutral", "enemy", "great enemy"].includes(d10)) expect(check(`In the D10, Shani is in a ${d10} sign.`)).toEqual([]);
  });

  it("dignity words far from a planet name, and comparisons with the D1, are not misread (live failures)", () => {
    const venusD9 = kundliCtx.placements.find((p) => p.graha === "Venus" && p.chart === "d9")!.rashi;
    const d1Venus = kundliCtx.placements.find((p) => p.graha === "Venus" && p.chart === "d1")!.rashi;
    if (venusD9 !== d1Venus) {
      expect(check(`The D9 is read next. Shukra in ${venusD9} is better, an improvement over D1.`)).toEqual([]);
      expect(check(`The D9 is read next. Shukra in ${venusD9} is neutral, improved from D1.`)).toEqual([]);
    }
    expect(check("The main weaknesses are weak Shukra, the seventh lord in Bhava 8, and the D10 tenth lord's great enemy dignity.").join()).not.toMatch(/for Venus/);
  });

  it("birth time: Lagna-dependent claims need the caveat once per field; firm planet claims must not get it (rule E4)", () => {
    const ctx = { ...placementCtx, birthTimeSensitive: { d9: true, d10: false, planets: [] } };
    const v = (field: string, t: string) => validateReading({ [field]: t }, ctx).join();
    // Lagna-dependent: the D9 7th house and its lord, in any field (summary and karmic included).
    expect(v("summary", "The D9 7th house is strong.")).toMatch(/summary: D9 Lagna-dependent claims/);
    expect(v("karmic_perspective", "The D9 7th lord is well placed.")).toMatch(/karmic_perspective/);
    expect(v("summary", "Tentatively, the D9 7th house is strong.")).toBe("");
    // A planet's own D9 dignity is firm: needs no caveat and must not get one.
    expect(v("summary", "Mangal is exalted in the D9.")).toBe("");
    expect(v("summary", "Tentatively, Mangal is exalted in the D9.")).toMatch(/firm; do not call them tentative/);
    expect(validateReading({ summary: "Tentatively, Mangal is exalted in the D9." }, { ...ctx, birthTimeSensitive: { ...ctx.birthTimeSensitive, planets: ["Mars"] } })).toEqual([]);
    // Once per section.
    expect(v("marriage", "Tentatively, the D9 7th house is Meena. The D9 Lagna is also tentative.")).toMatch(/once per section/);
    // The D10 is not sensitive here.
    expect(v("summary", "The D10 10th lord adds strength.")).toBe("");
  });

  it("a cancelled dosha does not operate: no residual wording (rule C1)", () => {
    const ctx = { ...placementCtx, cancelledDoshas: ["Kemadruma Dosha", "Kemadruma"] };
    expect(validateReading({ doshas: "Kemadruma Dosha is formed but cancelled; the cancellations reduce its isolating theme." }, ctx).join()).toMatch(/cancelled dosha/);
    expect(validateReading({ doshas: "Kemadruma is cancelled but not erased." }, ctx).join()).toMatch(/cancelled dosha/);
    expect(validateReading({ doshas: "Kemadruma Dosha is formed but cancelled: noted for completeness, it traditionally does not operate." }, ctx)).toEqual([]);
    expect(validateReading({ doshas: "Manglik Dosha remains; cancellations reduce it." }, ctx)).toEqual([]); // not cancelled
    expect(validateReading({ doshas: "Kemadruma is formed but cancelled. Manglik Dosha remains, and its cancellations reduce it." }, ctx)).toEqual([]);
  });

  it("a D1 house or lord in a sentence about a planet's D9 dignity is not a D9 Lagna claim (live failure)", () => {
    const ctx = { ...placementCtx, birthTimeSensitive: { d9: true, d10: false, planets: [] } };
    expect(validateReading({ health_wellbeing: "Chandra, the Lagna lord in Bhava 9, has own sign dignity in the D9." }, ctx).join()).not.toMatch(/Lagna-dependent/);
    expect(validateReading({ health_wellbeing: "The D9 7th lord is well placed." }, ctx).join()).toMatch(/Lagna-dependent/);
    expect(validateReading({ health_wellbeing: "Chandra has friend dignity in Bhava 9 and own sign in the D9." }, ctx).join()).not.toMatch(/Lagna-dependent/);
    expect(validateReading({ marriage: "The 7th house of the D9 is Meena." }, ctx).join()).toMatch(/Lagna-dependent/);
    expect(validateReading({ marriage: "The Navamsa Lagna is Kanya." }, ctx).join()).toMatch(/Lagna-dependent/);
  });

  it("transit sentences may name Saturn's and Jupiter's transit signs (live failure)", () => {
    const t = kundliCtx.transitPlacements!.find((p) => p.graha === "Jupiter" && !kundliCtx.placements.some((q) => q.graha === "Jupiter" && q.rashi === p.rashi))!;
    expect(check(`The window has a double transit, with Guru in ${t.rashi}.`)).toEqual([]);
    expect(check(`Guru in ${t.rashi} gives wisdom.`).join()).toMatch(/not in the computed facts/);
    // A window sentence naming the other planet "from" a sign is about transits too (live failure).
    expect(check(`28 Mar 2034 – 13 Jul 2034: Guru in ${t.rashi} and Shani from Mithuna jointly influence Meena.`).join()).not.toMatch(/Guru in/);
  });

  it("wording problems are marked as style; factual ones are not (a last attempt with style-only problems is kept)", () => {
    const style = validateReading({ personality: "Chandra is borderline.", summary: "Chandra is borderline. Sarvashtakavarga is not computed." }, placementCtx);
    expect(style.length).toBeGreaterThan(0);
    expect(style.every(isStyleProblem)).toBe(true);
    const fact = validateReading({ personality: "Mars in Mesha makes you bold." }, placementCtx);
    expect(fact.some((p) => !isStyleProblem(p))).toBe(true);
  });

  it("window total: 'the first N of M' must match, and the marriage section states the count (rule W1)", () => {
    const ctx = { ...placementCtx, windows: { count: 5, listed: 3, ranked: false } };
    const m = (t: string) => validateReading({ marriage: t }, ctx).join();
    expect(m("These are the first three of five windows.")).toBe("");
    expect(m("These are the first three of four windows.")).toMatch(/there are 5 timing windows, 3 listed/);
    expect(m("A window opens in 2028.")).toMatch(/say how many timing windows there are/);
  });

  it("a claim about only a firm 7th / 10th lord needs no caveat; the 7th house itself still does", () => {
    const ctx = { ...placementCtx, birthTimeSensitive: { d9: true, d10: false, planets: [], firmLords: { d9: true, d10: false } } };
    expect(validateReading({ marriage: "The D9 7th lord Shani is well placed." }, ctx).join()).not.toMatch(/Lagna-dependent/);
    expect(validateReading({ marriage: "The D9 7th house is Makara." }, ctx).join()).toMatch(/Lagna-dependent/);
    const notFirm = { ...ctx, birthTimeSensitive: { ...ctx.birthTimeSensitive, firmLords: { d9: false, d10: false } } };
    expect(validateReading({ marriage: "The D9 7th lord Shani is well placed." }, notFirm).join()).toMatch(/Lagna-dependent/);
  });

  it("'Both Dasha lords are not significators' is rewritten (rule W1)", () => {
    expect(validateReading({ marriage: "There are two windows. Both Dasha lords are not significators in either." }, { ...placementCtx, windows: { count: 2, ranked: false } }).join()).toMatch(/Neither window has both Dasha lords/);
  });

  it("window count and ranking follow FACTS (rule W1)", () => {
    const ctx = { ...kundliCtx, windows: { count: 3, ranked: false } };
    const c = (t: string) => validateReading({ marriage: t }, ctx);
    expect(c("There are three traditionally indicated windows.")).toEqual([]);
    expect(c("There are two windows.").join()).toMatch(/there are 3 timing windows/);
    expect(c("The 2036 window is stronger.").join()).toMatch(/ranks timing windows/);
    expect(validateReading({ marriage: "There are three windows. The 2036 window is stronger." }, { ...ctx, windows: { count: 3, ranked: true } })).toEqual([]);
  });

  it("borderline is said once per planet (rule E7)", () => {
    expect(validateReading({ personality: "Chandra is borderline.", summary: "Chandra's strength is borderline." }, kundliCtx).join()).toMatch(/Moon is called borderline 2 times/);
    expect(validateReading({ personality: "Chandra is borderline.", summary: "Budh is borderline." }, kundliCtx)).toEqual([]);
  });

  it("method wording stays out of the reading", () => {
    expect(check("Sarvashtakavarga is not computed here.").join()).toMatch(/describes the method/);
    expect(check("Rahu is explicitly not counted.").join()).toMatch(/describes the method/);
    expect(check("According to FACTS, Venus is weak.").join()).toMatch(/describes the method/);
    expect(check("These facts point to steady effort.")).toEqual([]);
  });
});
