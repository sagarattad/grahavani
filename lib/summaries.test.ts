import { describe, expect, it } from "vitest";
import { manglikCombined } from "./summaries";
import { severity } from "./glossary";

describe("Manglik severity", () => {
  it("knows 'medium'", () => {
    expect(severity("medium")).toBe("Medium");
  });
});

describe("manglikCombined", () => {
  const yes = { manglik: true, severity: "mild", ascendant_check: true, moon_check: false, venus_check: false, cancellations: [] };
  const no = { ...yes, manglik: false };
  it("uses Groom / Bride labels", () => {
    expect(manglikCombined(yes, no)).toMatch(/Only the Groom/);
    expect(manglikCombined(no, yes)).toMatch(/Only the Bride/);
    expect(manglikCombined(yes, yes)).toMatch(/balancing/);
  });
});
