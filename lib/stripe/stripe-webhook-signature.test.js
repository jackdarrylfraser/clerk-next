import { describe, expect, it, mock } from "bun:test";
import Stripe from "stripe";

const stripe = new Stripe("sk_test_placeholder");
mock.module("@/lib/stripe/stripe", () => ({ stripe }));
const { verifyStripeWebhookEvent } = await import("./stripe-webhook-signature");

describe("Stripe webhook signature verification", () => {
  const secret = "whsec_test_secret";
  const rawBody = JSON.stringify({
    id: "evt_test_123",
    type: "checkout.session.completed",
  });

  it("accepts a correctly signed raw event body", async () => {
    const signature = await stripe.webhooks.generateTestHeaderStringAsync({
      payload: rawBody,
      secret,
    });

    expect(
      await verifyStripeWebhookEvent(rawBody, signature, secret),
    ).toMatchObject({ id: "evt_test_123" });
  });

  it("rejects a missing or invalid signature", async () => {
    await expect(
      verifyStripeWebhookEvent(rawBody, null, secret),
    ).rejects.toThrow("signature is missing");
    await expect(
      verifyStripeWebhookEvent(rawBody, "invalid", secret),
    ).rejects.toThrow();
  });
});
