import { describe, expect, test } from "bun:test";
import { hasSubscriptionAccess } from "./stripe-access-policy.ts";

describe("Stripe subscription access policy", () => {
  test("grants access through a paid invoice period", () => {
    expect(
      hasSubscriptionAccess(
        { status: "active", trialEnd: null, paidThrough: 1_100 },
        1_000,
      ),
    ).toBe(true);
    expect(
      hasSubscriptionAccess(
        { status: "past_due", trialEnd: null, paidThrough: 1_100 },
        1_000,
      ),
    ).toBe(true);
  });

  test("grants access during an active trial", () => {
    expect(
      hasSubscriptionAccess(
        { status: "trialing", trialEnd: 1_100, paidThrough: null },
        1_000,
      ),
    ).toBe(true);
  });

  test("denies access after the paid period or trial ends", () => {
    expect(
      hasSubscriptionAccess(
        { status: "canceled", trialEnd: null, paidThrough: 900 },
        1_000,
      ),
    ).toBe(false);
    expect(
      hasSubscriptionAccess(
        { status: "trialing", trialEnd: 900, paidThrough: null },
        1_000,
      ),
    ).toBe(false);
    expect(
      hasSubscriptionAccess(
        { status: "incomplete", trialEnd: null, paidThrough: null },
        1_000,
      ),
    ).toBe(false);
  });
});
