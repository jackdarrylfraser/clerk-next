import type { IdempotencyRunResult } from "@outbound-endurance/kv";
import type { BillingNotificationContent } from "@/emails/billing-notification-content";
import { sendEmail } from "@/emails/send-email";
import {
  createCancellationScheduledEmail,
  createSubscriptionEndedEmail,
  createSubscriptionCreatedEmail,
  createSubscriptionPaymentFailedEmail,
  createSubscriptionRenewedEmail,
} from "@/emails/billing-notification-content";
import { idempotency } from "@/lib/kv";
import { invalidateStripeAccessCache } from "@/lib/stripe/stripe-access";
import {
  associateStripeCustomerWithUser,
  getStripeCheckoutUser,
  getStripeCustomerOwner,
  type StripeCustomerOwner,
} from "@/lib/stripe/stripe-customers";

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: { object: unknown; previous_attributes?: unknown };
}

export type StripeWebhookProcessResult =
  | { status: "ignored" }
  | Exclude<IdempotencyRunResult<{ userId: string }>, { status: "error" }>;

const CHECKOUT_PROVISIONING_SCOPE = "stripe-checkout-provisioning:v1";
const LIFECYCLE_NOTIFICATION_SCOPE = "stripe-lifecycle-notification:v1";

type LifecycleNotification =
  | { kind: "renewed"; customerId: string }
  | { kind: "payment-failed"; customerId: string }
  | {
      kind: "cancellation-scheduled";
      customerId: string;
      cancellationDate?: string;
    }
  | { kind: "ended"; customerId: string };

export async function processStripeWebhookEvent(
  event: StripeWebhookEvent,
): Promise<StripeWebhookProcessResult> {
  if (event.type === "checkout.session.completed") {
    return processCheckoutCompletedEvent(event);
  }

  const notification = getLifecycleNotification(event);
  if (!notification) {
    return { status: "ignored" };
  }

  const result = await runIdempotently(
    event,
    LIFECYCLE_NOTIFICATION_SCOPE,
    async () => {
      const user = await getStripeCustomerOwner(notification.customerId);
      if (!user) {
        throw new Error(
          "Stripe lifecycle event refers to an unmapped customer",
        );
      }

      await sendEmail({
        idempotencyKey: `stripe/${event.type}/${event.id}`,
        to: user.email,
        content: createLifecycleEmail(notification, user),
      });

      return { userId: user.id };
    },
  );

  return result;
}

async function processCheckoutCompletedEvent(
  event: StripeWebhookEvent,
): Promise<StripeWebhookProcessResult> {
  if (!isRecord(event.data.object)) {
    throw new Error("Stripe Checkout Session data is invalid");
  }

  const session = event.data.object;
  if (session.mode !== "subscription" || session.payment_status !== "paid") {
    return { status: "ignored" };
  }

  const userId =
    typeof session.client_reference_id === "string"
      ? session.client_reference_id.trim()
      : "";
  const customerId = getStripeCustomerId(session.customer);

  if (!userId || !customerId) {
    throw new Error(
      "Paid Stripe subscription checkout is missing its app user or customer ID",
    );
  }

  return runIdempotently(
    event,
    CHECKOUT_PROVISIONING_SCOPE,
    async () => {
      const user = await getStripeCheckoutUser(userId);
      if (!user) {
        throw new Error(
          "Stripe Checkout Session refers to an unknown app user",
        );
      }

      await associateStripeCustomerWithUser(customerId, user.id);
      await invalidateStripeAccessCache(user.id);

      const owner = await getStripeCustomerOwner(customerId);
      if (!owner) {
        throw new Error(
          "Stripe Checkout Session customer is not linked to an app user",
        );
      }

      await sendEmail({
        idempotencyKey: `stripe/${event.type}/${event.id}`,
        to: owner.email,
        content: createSubscriptionCreatedEmail({ firstName: owner.name }),
      });

      return { userId: user.id };
    },
  );
}

async function runIdempotently(
  event: StripeWebhookEvent,
  scope: string,
  operation: () => Promise<{ userId: string }>,
): Promise<
  Exclude<IdempotencyRunResult<{ userId: string }>, { status: "error" }>
> {
  const result = await idempotency.run({ scope, key: event.id }, operation);
  if (result.status === "error") {
    throw result.error;
  }

  return result;
}

function getLifecycleNotification(
  event: StripeWebhookEvent,
): LifecycleNotification | null {
  if (!isLifecycleEventType(event.type)) {
    return null;
  }
  if (!isRecord(event.data.object)) {
    throw new Error("Stripe lifecycle event data is invalid");
  }

  const object = event.data.object;
  if (event.type === "invoice.paid") {
    if (
      object.billing_reason !== "subscription_cycle" ||
      getInvoiceSubscriptionId(object) === null
    ) {
      return null;
    }
    return {
      kind: "renewed",
      customerId: requireCustomerId(object.customer, event),
    };
  }

  if (event.type === "invoice.payment_failed") {
    if (
      object.billing_reason !== "subscription_cycle" ||
      getInvoiceSubscriptionId(object) === null
    ) {
      return null;
    }
    return {
      kind: "payment-failed",
      customerId: requireCustomerId(object.customer, event),
    };
  }

  if (event.type === "customer.subscription.updated") {
    if (!isNewCancellationSchedule(object, event.data.previous_attributes)) {
      return null;
    }
    return {
      kind: "cancellation-scheduled",
      customerId: requireCustomerId(object.customer, event),
      cancellationDate: getCancellationDate(object),
    };
  }

  return {
    kind: "ended",
    customerId: requireCustomerId(object.customer, event),
  };
}

function isLifecycleEventType(type: string): boolean {
  return (
    type === "invoice.paid" ||
    type === "invoice.payment_failed" ||
    type === "customer.subscription.updated" ||
    type === "customer.subscription.deleted"
  );
}

function getInvoiceSubscriptionId(
  invoice: Record<string, unknown>,
): string | null {
  if (
    !isRecord(invoice.parent) ||
    invoice.parent.type !== "subscription_details" ||
    !isRecord(invoice.parent.subscription_details)
  ) {
    return null;
  }

  const subscription = invoice.parent.subscription_details.subscription;
  if (typeof subscription === "string") {
    return subscription;
  }
  if (isRecord(subscription) && typeof subscription.id === "string") {
    return subscription.id;
  }

  return null;
}

function isNewCancellationSchedule(
  subscription: Record<string, unknown>,
  previousAttributes: unknown,
): boolean {
  if (!isRecord(previousAttributes)) {
    return false;
  }

  const cancellationAtPeriodEndChanged =
    subscription.cancel_at_period_end === true &&
    previousAttributes.cancel_at_period_end === false;
  const customCancellationDateAdded =
    typeof subscription.cancel_at === "number" &&
    Object.hasOwn(previousAttributes, "cancel_at") &&
    previousAttributes.cancel_at === null;

  return cancellationAtPeriodEndChanged || customCancellationDateAdded;
}

function getCancellationDate(
  subscription: Record<string, unknown>,
): string | undefined {
  const timestamp =
    typeof subscription.cancel_at === "number"
      ? subscription.cancel_at
      : subscription.current_period_end;
  if (typeof timestamp !== "number" || !Number.isSafeInteger(timestamp)) {
    return undefined;
  }

  const date = new Date(timestamp * 1000);
  return Number.isNaN(date.getTime())
    ? undefined
    : date.toISOString().slice(0, 10);
}

function createLifecycleEmail(
  notification: LifecycleNotification,
  user: StripeCustomerOwner,
): BillingNotificationContent {
  const details = { firstName: user.name };
  switch (notification.kind) {
    case "renewed":
      return createSubscriptionRenewedEmail(details);
    case "payment-failed":
      return createSubscriptionPaymentFailedEmail(details);
    case "cancellation-scheduled":
      return createCancellationScheduledEmail({
        ...details,
        cancellationDate: notification.cancellationDate,
      });
    case "ended":
      return createSubscriptionEndedEmail(details);
  }
}

function requireCustomerId(
  customer: unknown,
  event: StripeWebhookEvent,
): string {
  const customerId = getStripeCustomerId(customer);
  if (!customerId) {
    throw new Error(
      `Stripe lifecycle event ${event.id} is missing its customer ID`,
    );
  }
  return customerId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStripeCustomerId(customer: unknown): string | null {
  if (typeof customer === "string") {
    return customer.trim() ? customer : null;
  }
  if (!isRecord(customer) || customer.deleted === true) {
    return null;
  }

  return typeof customer.id === "string" && customer.id.trim()
    ? customer.id
    : null;
}
