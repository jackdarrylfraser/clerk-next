import { describe, expect, it } from "bun:test";
import { processStripeWebhookEvent } from "./stripe-webhook";

function createMemoryDependencies({ user = { id: "user_123", email: "app@example.com", name: "Ada" } } = {}) {
  const completed = new Map();
  const calls = {
    userLookups: [],
    customerAssociations: [],
    cacheInvalidations: [],
  };

  return {
    calls,
    dependencies: {
      idempotency: {
        async run(config, operation) {
          const key = `${config.scope}:${config.key}`;
          if (completed.has(key)) {
            return { status: "duplicate", value: completed.get(key) };
          }

          try {
            const value = await operation();
            completed.set(key, value);
            return { status: "executed", value };
          } catch (error) {
            return { status: "error", error };
          }
        },
      },
      async findUser(userId) {
        calls.userLookups.push(userId);
        return user ? { id: user.id } : null;
      },
      async associateCustomer(customerId, userId) {
        calls.customerAssociations.push({ customerId, userId });
      },
      async invalidateAccess(userId) {
        calls.cacheInvalidations.push(userId);
      },
    },
  };
}

function createCheckoutEvent({
  id = "evt_checkout_123",
  type = "checkout.session.completed",
  mode = "subscription",
  paymentStatus = "paid",
  userId = "user_123",
  customer = "cus_123",
} = {}) {
  return {
    id,
    type,
    data: {
      object: {
        mode,
        payment_status: paymentStatus,
        client_reference_id: userId,
        customer,
        customer_details: { email: "stripe-entered@example.com" },
      },
    },
  };
}

describe("Stripe checkout webhook processing", () => {
  it("maps a paid checkout to the existing app user and invalidates their access cache", async () => {
    const { calls, dependencies } = createMemoryDependencies();

    await expect(
      processStripeWebhookEvent(createCheckoutEvent(), dependencies),
    ).resolves.toEqual({
      status: "executed",
      value: { userId: "user_123" },
    });

    expect(calls.userLookups).toEqual(["user_123"]);
    expect(calls.customerAssociations).toEqual([
      { customerId: "cus_123", userId: "user_123" },
    ]);
    expect(calls.cacheInvalidations).toEqual(["user_123"]);
  });

  it("ignores delayed-payment events, pending payments, and non-subscription checkouts", async () => {
    const { calls, dependencies } = createMemoryDependencies();

    const events = [
      createCheckoutEvent({ type: "checkout.session.async_payment_succeeded" }),
      createCheckoutEvent({ paymentStatus: "unpaid" }),
      createCheckoutEvent({ mode: "payment" }),
    ];

    for (const event of events) {
      await expect(
        processStripeWebhookEvent(event, dependencies),
      ).resolves.toEqual({ status: "ignored" });
    }

    expect(calls.userLookups).toEqual([]);
    expect(calls.customerAssociations).toEqual([]);
    expect(calls.cacheInvalidations).toEqual([]);
  });

  it("does not repeat provisioning work for a duplicate Stripe event", async () => {
    const { calls, dependencies } = createMemoryDependencies();
    const event = createCheckoutEvent();

    await processStripeWebhookEvent(event, dependencies);
    await expect(
      processStripeWebhookEvent(event, dependencies),
    ).resolves.toEqual({
      status: "duplicate",
      value: { userId: "user_123" },
    });

    expect(calls.customerAssociations).toHaveLength(1);
    expect(calls.cacheInvalidations).toHaveLength(1);
  });

  it("rejects paid checkouts without an app user or Stripe customer ID", async () => {
    const { calls, dependencies } = createMemoryDependencies();

    await expect(
      processStripeWebhookEvent(
        createCheckoutEvent({ userId: null }),
        dependencies,
      ),
    ).rejects.toThrow("missing its app user or customer ID");
    await expect(
      processStripeWebhookEvent(
        createCheckoutEvent({ customer: null }),
        dependencies,
      ),
    ).rejects.toThrow("missing its app user or customer ID");

    expect(calls.customerAssociations).toEqual([]);
  });

  it("fails when the server-associated app user cannot be found", async () => {
    const { calls, dependencies } = createMemoryDependencies({ user: null });

    await expect(
      processStripeWebhookEvent(createCheckoutEvent(), dependencies),
    ).rejects.toThrow("unknown app user");

    expect(calls.customerAssociations).toEqual([]);
    expect(calls.cacheInvalidations).toEqual([]);
  });

  it("does not continue if a Stripe customer is associated with another user", async () => {
    const { calls, dependencies } = createMemoryDependencies();
    dependencies.associateCustomer = async () => {
      throw new Error("Stripe customer is already associated with another user");
    };

    await expect(
      processStripeWebhookEvent(createCheckoutEvent(), dependencies),
    ).rejects.toThrow("already associated with another user");

    expect(calls.cacheInvalidations).toEqual([]);
  });
});
