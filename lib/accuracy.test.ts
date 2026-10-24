import { describe, expect, it } from "vitest";
import { nearNakshatraBoundary, nearSignBoundary } from "./accuracy";
import { dateOnly, dms } from "./format";

describe("accuracy notes", () => {
  it("flags degrees within 1° of a sign boundary", () => {
    expect(nearSignBoundary(0.5)).toBe(true);
    expect(nearSignBoundary(29.5)).toBe(true);
    expect(nearSignBoundary(18.1)).toBe(false);
  });

  it("flags longitudes within 1° of a nakshatra boundary", () => {
    expect(nearNakshatraBoundary(13.3333 + 0.4)).toBe(true); // just after Ashwini→Bharani
    expect(nearNakshatraBoundary(26.6667 - 0.5)).toBe(true); // just before Krittika
    expect(nearNakshatraBoundary(142.22)).toBe(false);
  });
});

describe("dateOnly (IST)", () => {
  it("shows instants in IST, whatever the offset sent", () => {
    expect(dateOnly("2037-09-19T08:55:36.358+05:30")).toBe("19 Sep 2037");
    expect(dateOnly("2026-01-25T20:00:00Z")).toBe("26 Jan 2026"); // 01:30 IST next day
    expect(dateOnly("2026-01-25T18:00:00Z")).toBe("25 Jan 2026"); // 23:30 IST
  });
  it("shows civil dates as written", () => {
    expect(dateOnly("1990-01-15")).toBe("15 Jan 1990");
  });
});

describe("dms", () => {
  it("formats degrees and minutes", () => {
    expect(dms(18.111306)).toBe("18°06′");
    expect(dms(1.229)).toBe("1°13′");
  });
});
