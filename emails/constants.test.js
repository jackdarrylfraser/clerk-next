import { describe, expect, it } from "bun:test";
import { EMAIL_EVENTS, IDEMPOTENCY_PREFIXES } from "./constants";

describe("email idempotency constants", () => {
  it("uses one event prefix for scopes and Resend email keys", () => {
    expect(IDEMPOTENCY_PREFIXES.subscriptionCreated).toBe(
      `resend/${EMAIL_EVENTS.subscriptionCreated}`,
    );
    expect(IDEMPOTENCY_PREFIXES.paymentFailed).toBe(
      `resend/${EMAIL_EVENTS.paymentFailed}`,
    );
    expect(IDEMPOTENCY_PREFIXES.subscriptionCanceled).toBe(
      `resend/${EMAIL_EVENTS.subscriptionCanceled}`,
    );
    expect(IDEMPOTENCY_PREFIXES.marketingOptIn).toBe(
      `resend/${EMAIL_EVENTS.marketingOptIn}`,
    );
  });
});
