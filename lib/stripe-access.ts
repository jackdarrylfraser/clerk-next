import "server-only";
import Stripe from "stripe";
import { idempotency } from "@/lib/kv";
import { stripe } from "@/lib/stripe";
import { getStripeCustomerIdsForUser } from "@/lib/stripe-customers";
import {
  checkStripeAccess,
  invalidateStripeAccessCache as invalidateAccessCache,
} from "@/lib/stripe-access-policy";

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent;
  if (parent?.type !== "subscription_details") {
    return null;
  }

  const subscription = parent.subscription_details?.subscription;
  if (typeof subscription === "string") {
    return subscription;
  }
  return subscription?.id ?? null;
}

async function getCustomerAccessStates(
  customerId: string,
): Promise<
  Array<{
    status: string;
    trialEnd: number | null;
    paidThrough: number | null;
  }>
> {
  const states = new Map<
    string,
    { status: string; trialEnd: number | null; paidThrough: number | null }
  >();

  for await (const subscription of stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  })) {
    states.set(subscription.id, {
      status: subscription.status,
      trialEnd: subscription.trial_end,
      paidThrough: null,
    });
  }

  for await (const invoice of stripe.invoices.list({
    customer: customerId,
    status: "paid",
    limit: 100,
  })) {
    const subscriptionId = getInvoiceSubscriptionId(invoice);
    if (subscriptionId === null) {
      continue;
    }

    const state = states.get(subscriptionId) ?? {
      status: "canceled",
      trialEnd: null,
      paidThrough: null,
    };
    state.paidThrough = Math.max(state.paidThrough ?? 0, invoice.period_end);
    states.set(subscriptionId, state);
  }

  return Array.from(states.values());
}

export function hasStripeAccess(userId: string): Promise<boolean> {
  return checkStripeAccess(userId, {
    getCustomerIds: getStripeCustomerIdsForUser,
    getAccessStates: getCustomerAccessStates,
    idempotency,
  });
}

export function invalidateStripeAccessCache(userId: string): Promise<void> {
  return invalidateAccessCache(userId, idempotency);
}
