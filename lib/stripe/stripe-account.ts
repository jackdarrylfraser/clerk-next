import "server-only";
import Stripe from "stripe";
import { formatStripeAmount } from "@/lib/stripe/helper/stripe-checkout-policy";
import {
  canManageStripeSubscription,
  getLatestPeriodEnd,
  isCancellationScheduled,
} from "@/lib/stripe/helper/stripe-account-policy";
import { getStripeCustomerIdsForUser } from "@/lib/stripe/stripe-customers";
import { stripe } from "@/lib/stripe/stripe";

export interface StripeAccountSubscriptionItem {
  name: string;
  price: string | null;
  interval: string | null;
  quantity: number;
}

export interface StripeAccountSubscription {
  id: string;
  status: string;
  statusLabel: string;
  items: StripeAccountSubscriptionItem[];
  cancelAtPeriodEnd: boolean;
  cancelAt: number | null;
  currentPeriodEnd: number | null;
  endedAt: number | null;
  cancellationScheduled: boolean;
  canManageCancellation: boolean;
}

export interface StripeAccountCustomer {
  id: string;
  email: string | null;
  deleted: boolean;
  subscriptions: StripeAccountSubscription[];
}

export async function getStripeAccountOverview(
  userId: string,
): Promise<StripeAccountCustomer[]> {
  const customerIds = await getStripeCustomerIdsForUser(userId);

  return Promise.all(customerIds.map(getCustomerOverview));
}

async function getCustomerOverview(
  customerId: string,
): Promise<StripeAccountCustomer> {
  const [customer, subscriptions] = await Promise.all([
    stripe.customers.retrieve(customerId),
    getCustomerSubscriptions(customerId),
  ]);
  const deleted = "deleted" in customer && customer.deleted === true;

  return {
    id: customerId,
    email: deleted ? null : customer.email,
    deleted,
    subscriptions: subscriptions.map(toAccountSubscription),
  };
}

async function getCustomerSubscriptions(
  customerId: string,
): Promise<Stripe.Subscription[]> {
  const subscriptions: Stripe.Subscription[] = [];

  for await (const subscription of stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
    expand: ["data.items.data.price.product"],
  })) {
    subscriptions.push(subscription);
  }

  return subscriptions;
}

function toAccountSubscription(
  subscription: Stripe.Subscription,
): StripeAccountSubscription {
  const currentPeriodEnd = getLatestPeriodEnd(
    subscription.items.data.map((item) => item.current_period_end),
  );
  const cancellationScheduled = isCancellationScheduled(
    subscription.status,
    subscription.cancel_at_period_end,
    subscription.cancel_at,
  );

  return {
    id: subscription.id,
    status: subscription.status,
    statusLabel: formatStatus(subscription.status),
    items: subscription.items.data.map((item) => ({
      name: getProductName(item.price),
      price: getFormattedPrice(item.price, item.quantity ?? 1),
      interval: formatInterval(item.price.recurring),
      quantity: item.quantity ?? 1,
    })),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    cancelAt: subscription.cancel_at,
    currentPeriodEnd,
    endedAt: subscription.ended_at,
    cancellationScheduled,
    canManageCancellation: canManageStripeSubscription(subscription.status),
  };
}

function getProductName(price: Stripe.Price): string {
  const product = price.product;
  if (typeof product === "object" && "name" in product) {
    return product.name;
  }

  return price.nickname ?? price.id;
}

function getFormattedPrice(price: Stripe.Price, quantity: number): string | null {
  const amount =
    price.unit_amount_decimal === null
      ? price.unit_amount
      : Number(price.unit_amount_decimal);

  if (amount === null) {
    return null;
  }

  return formatStripeAmount(amount * quantity, price.currency);
}

function formatInterval(
  recurring: Stripe.Price.Recurring | null,
): string | null {
  if (recurring === null) {
    return null;
  }

  const intervalCount = recurring.interval_count;
  const interval = recurring.interval;
  if (intervalCount === 1) {
    return `per ${interval}`;
  }

  return `every ${intervalCount} ${interval}s`;
}

function formatStatus(status: string): string {
  if (status === "canceled" || status === "incomplete_expired") {
    return "Ended";
  }

  return status.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}
