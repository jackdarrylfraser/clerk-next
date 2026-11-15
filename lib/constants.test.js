import { describe, expect, it } from "bun:test";
import {
  EMAIL_EVENTS,
  IDEMPOTENCY_CACHE_RESET_NAMESPACE,
  IDEMPOTENCY_SCOPES,
} from "./constants.ts";

describe("idempotency scopes", () => {
  it("uses stable scopes without a build or cache-reset prefix by default", () => {
    expect(IDEMPOTENCY_CACHE_RESET_NAMESPACE).toBe("");
    expect(IDEMPOTENCY_SCOPES.marketingOptIn).toBe(
      `resend/${EMAIL_EVENTS.marketingOptIn}`,
    );
    expect(IDEMPOTENCY_SCOPES.stripeAccess).toBe("stripe-access:v1");
  });

  it("includes the operation and event in the scope", () => {
    expect(`${IDEMPOTENCY_SCOPES.stripeLifecycleNotification}/invoice.paid`)
      .toBe("stripe-lifecycle-notification/invoice.paid");
  });
});
