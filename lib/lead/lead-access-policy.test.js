import { describe, expect, it } from "bun:test";
import {
  isLeadAccessIssuedAfterRevocation,
  isLeadVerificationCurrent,
  leadAccessWindowMs,
} from "./lead-access-policy.ts";

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

describe("isLeadAccessIssuedAfterRevocation", () => {
  const revokedBefore = new Date("2026-11-14T12:00:00.000Z");

  it("allows tokens issued at or after the revocation cutoff", () => {
    expect(
      isLeadAccessIssuedAfterRevocation(
        revokedBefore.getTime(),
        revokedBefore,
      ),
    ).toBe(true);
    expect(
      isLeadAccessIssuedAfterRevocation(
        revokedBefore.getTime() + 1,
        revokedBefore,
      ),
    ).toBe(true);
  });

  it("rejects older tokens and legacy tokens without an issue time", () => {
    expect(
      isLeadAccessIssuedAfterRevocation(
        revokedBefore.getTime() - 1,
        revokedBefore,
      ),
    ).toBe(false);
    expect(isLeadAccessIssuedAfterRevocation(undefined, revokedBefore)).toBe(
      false,
    );
    expect(isLeadAccessIssuedAfterRevocation(undefined, null)).toBe(true);
  });
});
