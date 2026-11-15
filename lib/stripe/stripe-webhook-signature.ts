import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/stripe";

export async function verifyStripeWebhookEvent(
  rawBody: string,
  signature: string | null,
  secret: string,
): Promise<Stripe.Event> {
  if (!signature?.trim()) {
    throw new Error("The Stripe webhook signature is missing");
  }

  return stripe.webhooks.constructEventAsync(rawBody, signature, secret);
}
