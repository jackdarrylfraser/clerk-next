import { describe, expect, it } from "bun:test";
import { createIdempotencyPrefix } from "../packages/kv/src/idempotency.ts";
import { IDEMPOTENCY_PREFIXES } from "./constants.ts";

describe("idempotency scopes", () => {
  it("uses stable scopes without a cache-reset prefix by default", () => {
    expect(
      createIdempotencyPrefix({
        namespace: IDEMPOTENCY_PREFIXES.namespace,
        ...IDEMPOTENCY_PREFIXES.resend.events.marketingOptIn,
      }),
    ).toBe("resend/marketing.opted_in");
    expect(
      createIdempotencyPrefix({
        namespace: IDEMPOTENCY_PREFIXES.namespace,
        ...IDEMPOTENCY_PREFIXES.stripe.access,
      }),
    ).toBe("stripe-access:v1");
  });

  it("includes the operation and event in the scope", () => {
    expect(
      createIdempotencyPrefix({
        namespace: IDEMPOTENCY_PREFIXES.namespace,
        ...IDEMPOTENCY_PREFIXES.stripe.lifecycleNotification,
      }),
    ).toBe(
      "stripe/email.notification",
    );
    expect(
      createIdempotencyPrefix({
        namespace: IDEMPOTENCY_PREFIXES.namespace,
        ...IDEMPOTENCY_PREFIXES.stripe.checkoutProvisioning,
      }),
    ).toBe(
      "stripe-checkout-provisioning:v1",
    );
  });

  it("defines prefixes for provider idempotency keys", () => {
    expect(
      createIdempotencyPrefix({
        namespace: IDEMPOTENCY_PREFIXES.namespace,
        ...IDEMPOTENCY_PREFIXES.stripe.eventEmail,
      }),
    ).toBe("stripe");
    expect(
      createIdempotencyPrefix({
        namespace: IDEMPOTENCY_PREFIXES.namespace,
        ...IDEMPOTENCY_PREFIXES.betterAuth.otp,
      }),
    ).toBe("better-auth/otp");
    expect(
      createIdempotencyPrefix({
        namespace: IDEMPOTENCY_PREFIXES.namespace,
        ...IDEMPOTENCY_PREFIXES.betterAuth.leadOtp,
      }),
    ).toBe("better-auth/lead-otp");
    expect(
      createIdempotencyPrefix({
        namespace: IDEMPOTENCY_PREFIXES.namespace,
        ...IDEMPOTENCY_PREFIXES.stripe.catalog.product,
      }),
    ).toBe(
      "outbound-catalog-product",
    );
    expect(
      createIdempotencyPrefix({
        namespace: IDEMPOTENCY_PREFIXES.namespace,
        ...IDEMPOTENCY_PREFIXES.stripe.catalog.price,
      }),
    ).toBe(
      "outbound-catalog-price",
    );
  });
});
