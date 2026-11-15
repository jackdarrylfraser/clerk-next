import { describe, expect, it } from "bun:test";
import { isLeadVerificationCurrent, leadAccessWindowMs } from "./lead-access-policy.ts";

describe("isLeadVerificationCurrent", () => {
  const now = new Date("2026-11-14T12:00:00.000Z");

  it("allows a lead verified within the previous 30 days", () => {
    expect(
      isLeadVerificationCurrent(new Date(now.getTime() - leadAccessWindowMs + 1), now),
    ).toBe(true);
  });

  it("allows a lead verified exactly 30 days ago", () => {
    expect(
      isLeadVerificationCurrent(new Date(now.getTime() - leadAccessWindowMs), now),
    ).toBe(true);
  });

  it("rejects older or missing verification timestamps", () => {
    expect(
      isLeadVerificationCurrent(new Date(now.getTime() - leadAccessWindowMs - 1), now),
    ).toBe(false);
    expect(isLeadVerificationCurrent(null, now)).toBe(false);
  });
});
