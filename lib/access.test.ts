import { describe, expect, it } from "vitest";
import { allowedEmails, gate, isAllowedEmail } from "./access";

const list = ["me@gmail.com", "friend@example.com"];

describe("private mode (ALLOWED_EMAILS)", () => {
  it("parses commas, spaces and case; empty means off", () => {
    expect(allowedEmails(" Me@Gmail.com, friend@example.com ;x@y.z ")).toEqual(["me@gmail.com", "friend@example.com", "x@y.z"]);
    expect(allowedEmails("")).toBeNull();
    expect(allowedEmails(undefined)).toBeNull();
  });

  it("only listed emails are allowed", () => {
    expect(isAllowedEmail("ME@gmail.com", list)).toBe(true);
    expect(isAllowedEmail("stranger@gmail.com", list)).toBe(false);
    expect(isAllowedEmail(null, list)).toBe(false);
    expect(isAllowedEmail("anyone@x.com", null)).toBe(true); // private mode off
  });

  it("pages send strangers to /signin, APIs answer 401", () => {
    expect(gate("/", null, list)).toBe("signin");
    expect(gate("/kundli/abc123", "stranger@gmail.com", list)).toBe("signin");
    expect(gate("/api/reading", null, list)).toBe("unauthorized");
    expect(gate("/kundli/abc123", "me@gmail.com", list)).toBe("allow");
  });

  it("sign-in, privacy, Auth.js, cron and health stay reachable", () => {
    for (const p of ["/signin", "/privacy", "/api/auth/signin/google", "/api/auth/callback/google", "/api/cron/daily", "/api/health"]) {
      expect(gate(p, null, list), p).toBe("allow");
    }
    expect(gate("/signin-fake", null, list)).toBe("signin");
  });

  it("does nothing when private mode is off", () => {
    expect(gate("/", null, null)).toBe("allow");
    expect(gate("/api/reading", null, null)).toBe("allow");
  });
});
