import { describe, expect, it } from "vitest";
import { renderPdf, pdfDisposition } from "./render";
import { loadKaalSarpFixtures, loadKundliFixtures, loadManglikFixtures, loadMilanFixtures } from "../../tests/fixtures";
import { buildDoshas } from "../doshas";

const [k1, k2] = loadKundliFixtures();
const [m1] = loadManglikFixtures();
const milan = loadMilanFixtures().find((f) => f.file.includes("nadi-cancelled"))!;
const person = (name: string) => ({ name, birthDate: "1990-01-15", birthTime: "14:30", placeLabel: "Raipur, Chhattisgarh, India" });
/** Drops the fixture-only `file` and `attribution` keys. */
function strip<T extends { file: string; attribution: unknown }>(f: T): Omit<T, "file" | "attribution"> {
  const rest: Partial<T> = { ...f };
  delete rest.file;
  delete rest.attribution;
  return rest as Omit<T, "file" | "attribution">;
}

const ks = strip(loadKaalSarpFixtures().find((k) => k.file.includes("present"))!);
const doshasFor = (chart: typeof k1.chart, manglik: ReturnType<typeof strip<typeof m1>> | null) =>
  buildDoshas({ chart, manglik, kaalSarp: ks, asOf: chart.vimshottari.current.as_of });

const kundliReading = {
  personality: "Vrishabha Lagna is traditionally associated with steadiness.",
  career: "…",
  marriage: "…",
  health_wellbeing: "For any health concern, consult a doctor.",
  current_dasha: "Rahu Mahadasha runs until 19 Sep 2037.",
  yogas: "Ruchaka yoga is listed.",
  doshas: "Manglik Dosha is present and mild.",
  summary: "…",
  karmic_perspective: "Ketu in Bhava 8 is traditionally read as what the soul has already mastered.",
};

const isPdf = (buf: Buffer) => {
  expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  expect(buf.length).toBeLessThan(500_000);
};

describe("PDF rendering", () => {
  it("Kundli, with and without a reading", async () => {
    const data = {
      person: person("Test Person"),
      chart: k1.chart,
      dasha: k1.chart.vimshottari.current,
      doshas: doshasFor(k1.chart, strip(m1)),
      attribution: k1.attribution,
    };
    isPdf(await renderPdf({ kind: "kundli", data: { ...data, reading: null } }));
    isPdf(await renderPdf({ kind: "kundli", data: { ...data, reading: kundliReading } }));
    const about = { "yoga.raja": "Traditionally linked with recognition.", manglik: "Calm description." };
    isPdf(await renderPdf({ kind: "kundli", data: { ...data, about, reading: null } }));
  }, 30_000);

  it("Manglik", async () => {
    const { attribution, ...manglik } = { ...strip(m1), attribution: m1.attribution };
    isPdf(await renderPdf({ kind: "manglik", data: { person: person("Test Person"), manglik, attribution, reading: null } }));
  }, 30_000);

  it("Gun Milan with a cancelled Nadi Dosha", async () => {
    const data = {
      groom: { ...person("Test Groom"), chart: k1.chart, manglik: strip(m1), doshas: doshasFor(k1.chart, strip(m1)) },
      bride: { ...person("Test Bride"), chart: k2.chart, manglik: null, doshas: doshasFor(k2.chart, null) },
      milan: strip(milan),
      attribution: milan.attribution,
      reading: null,
    };
    isPdf(await renderPdf({ kind: "milan", data }));
  }, 30_000);
});

describe("pdfDisposition", () => {
  it("gives an ASCII filename plus the UTF-8 original", () => {
    const d = pdfDisposition("milan", ["Rahul", "Priyā Sharma"]);
    expect(d).toContain('filename="Grahavani-Gun-Milan-Rahul-Priya-Sharma.pdf"');
    expect(d).toContain("filename*=UTF-8''");
  });
});
