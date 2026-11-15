import type Stripe from "stripe";

export async function verifyStripeWebhookEvent(
  stripeClient: Pick<Stripe, "webhooks">,
  rawBody: string,
  signature: string | null,
  secret: string,
): Promise<Stripe.Event> {
  if (!signature?.trim()) {
    throw new Error("The Stripe webhook signature is missing");
  }

  return stripeClient.webhooks.constructEventAsync(rawBody, signature, secret);
}
