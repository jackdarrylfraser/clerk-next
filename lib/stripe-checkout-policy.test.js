import { describe, expect, test } from "bun:test";
import {
  formatStripeAmount,
  getStripeCheckoutPaymentState,
} from "./stripe-checkout-policy.ts";

describe("Stripe checkout return policy", () => {
  test("treats a completed paid session as successful", () => {
    expect(
      getStripeCheckoutPaymentState({
        status: "complete",
        paymentStatus: "paid",
      }),
    ).toBe("complete");
  });

  test("treats a completed session with payment still pending as processing", () => {
    expect(
      getStripeCheckoutPaymentState({
        status: "complete",
        paymentStatus: "unpaid",
      }),
    ).toBe("processing");
  });

  test("does not treat an open session as paid", () => {
    expect(
      getStripeCheckoutPaymentState({
        status: "open",
        paymentStatus: "unpaid",
      }),
    ).toBe("incomplete");
  });

  test("formats Stripe amounts using the currency's minor unit", () => {
    expect(formatStripeAmount(1250, "usd")).toBe("$12.50");
    expect(formatStripeAmount(1500, "jpy")).toBe("¥1,500");
    expect(formatStripeAmount(null, "usd")).toBeNull();
  });
});
