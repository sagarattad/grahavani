import { describe, expect, it } from "vitest";
import { checkDates, validateReading } from "./validate";
import { kundliFacts, manglikFacts, milanFacts } from "./facts";
import { refusalTopic } from "./refusal";
import { loadKaalSarpFixtures, loadKundliFixtures, loadManglikFixtures, loadMilanFixtures } from "../../tests/fixtures";

const raipur = loadKundliFixtures().find((f) => f.file.includes("raipur"))!.chart;
const [manglikFx] = loadManglikFixtures();
const kaalSarpFx = loadKaalSarpFixtures().find((k) => k.file.includes("absent"))!;
const extras = { manglik: manglikFx, kaalSarp: kaalSarpFx, birthDate: "1990-01-15" };
const { ctx: kundliCtx, facts } = kundliFacts(raipur, raipur.vimshottari.current, extras);
const followup = kundliFacts(raipur, raipur.vimshottari.current, extras, true);

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

  it("reading facts exclude transit dates and timing candidates; follow-up facts include them", () => {
    expect(JSON.stringify(facts)).not.toMatch(/Sade Sati|Dhaiya|timing_candidates/);
    expect(followup.facts).toHaveProperty("timing_candidates");
    expect(JSON.stringify(followup.facts)).toMatch(/Sade Sati/);
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
    expect(validateReading(kundliOut(text), kundliCtx)).toEqual([]);
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
  // Raipur: Raj Yoga and Dhana Yoga rated Moderate, Manglik Dosha intensity: Low.
  const check = (text: string) => validateReading({ yogas: text }, kundliCtx);

  it("facts carry the fixed rating phrase", () => {
    const raj = (facts.yogas_present as { yoga: string; rating: string }[]).find((y) => y.yoga === "Raj Yoga")!;
    expect(raj.rating).toBe("rated Moderate");
    expect(JSON.stringify(facts.doshas)).toMatch(/"rating":"intensity: Low"/);
    expect(JSON.stringify(facts.grahas)).toMatch(/"avastha":"Bala"/);
  });

  it("a yoga's rating must match FACTS", () => {
    expect(check("Your Raj Yoga is rated Moderate here.")).toEqual([]);
    expect(check("Your Raj Yoga is rated Strong here.").join()).toMatch(/Raj Yoga: text says "rated Strong", computed rated Moderate/);
  });

  it("a dosha's intensity must match FACTS", () => {
    expect(check("Manglik Dosha, intensity: Low, with one cancellation.")).toEqual([]);
    expect(check("Manglik Dosha, intensity: High.").join()).toMatch(/computed intensity: Low/);
  });

  it("other uses of strong, weak, high or low are ignored", () => {
    expect(check("Raj Yoga gives a strong sense of duty and high standards; low moods pass quickly.")).toEqual([]);
  });

  it("a longer name is not mistaken for a shorter one", () => {
    // Raipur has no Neechabhanga Raj Yoga, so this sentence names no rated item.
    expect(check("Neechabhanga Raj Yoga is rated Moderate.").join()).toMatch(/neechabhanga raj: .*computed no rating/);
  });

  it("a fixed phrase in a sentence naming two items, or none, is rejected", () => {
    expect(check("Raj Yoga and Dhana Yoga are rated Moderate.").join()).toMatch(/clearly belong to one/);
    expect(check("It is rated Moderate.").join()).toMatch(/clearly belong to one/);
  });

  it("several items in one sentence: each phrase follows its own item's name", () => {
    expect(check("Raj Yoga is rated Moderate, while Ruchaka is rated Weak.")).toEqual([]);
    expect(check("Raj Yoga is rated Moderate, while Ruchaka is rated Strong.").join()).toMatch(/Ruchaka: text says "rated Strong"/);
    expect(check("Manglik Dosha has intensity: Low and Raj Yoga is rated Moderate.")).toEqual([]);
  });

  it("a rating can refer back to the item named just before (the live failures)", () => {
    expect(check("Manglik Dosha is present. Its intensity: Low.")).toEqual([]);
    expect(check("Manglik Dosha is mild; intensity: Low.")).toEqual([]);
    expect(check("Raj Yoga links the 1st and 5th lords. It is rated Moderate because of combustion.")).toEqual([]);
    expect(check("Manglik Dosha is present. Its intensity: High.").join()).toMatch(/computed intensity: Low/);
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
