import type { IdempotencyRunResult } from "@clerk-next/kv";

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: { object: unknown };
}

export interface StripeCheckoutUser {
  id: string;
}

export interface StripeWebhookIdempotency {
  run<T>(
    config: { scope: string; key: string },
    operation: () => Promise<T>,
  ): Promise<IdempotencyRunResult<T>>;
}

export interface StripeWebhookDependencies {
  idempotency: StripeWebhookIdempotency;
  findUser(userId: string): Promise<StripeCheckoutUser | null>;
  associateCustomer(customerId: string, userId: string): Promise<void>;
  invalidateAccess(userId: string): Promise<void>;
}

export type StripeWebhookProcessResult =
  | { status: "ignored" }
  | Exclude<IdempotencyRunResult<{ userId: string }>, { status: "error" }>;

const CHECKOUT_PROVISIONING_SCOPE = "stripe-checkout-provisioning:v1";

export async function processStripeWebhookEvent(
  event: StripeWebhookEvent,
  dependencies: StripeWebhookDependencies,
): Promise<StripeWebhookProcessResult> {
  if (event.type !== "checkout.session.completed") {
    return { status: "ignored" };
  }

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

  const result = await dependencies.idempotency.run(
    { scope: CHECKOUT_PROVISIONING_SCOPE, key: event.id },
    async () => {
      const user = await dependencies.findUser(userId);
      if (!user) {
        throw new Error("Stripe Checkout Session refers to an unknown app user");
      }

      await dependencies.associateCustomer(customerId, user.id);
      await dependencies.invalidateAccess(user.id);

      return { userId: user.id };
    },
  );

  if (result.status === "error") {
    throw result.error;
  }

  return result;
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
