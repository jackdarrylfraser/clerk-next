import { describe, expect, it } from "bun:test";
import { processStripeWebhookEvent } from "./stripe-webhook";

function createMemoryDependencies({ user = { id: "user_123", email: "app@example.com", name: "Ada" } } = {}) {
  const completed = new Map();
  const calls = {
    userLookups: [],
    customerAssociations: [],
    cacheInvalidations: [],
    customerOwnerLookups: [],
    lifecycleNotifications: [],
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
      async findUserForCustomer(customerId) {
        calls.customerOwnerLookups.push(customerId);
        return user;
      },
      async sendLifecycleNotification(account, event, content) {
        calls.lifecycleNotifications.push({
          email: account.email,
          eventId: event.id,
          eventType: event.type,
          content,
        });
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

function createInvoiceEvent({
  id = "evt_invoice_123",
  type = "invoice.paid",
  billingReason = "subscription_cycle",
  customer = "cus_123",
} = {}) {
  return {
    id,
    type,
    data: {
      object: {
        customer,
        customer_email: "stripe-entered@example.com",
        billing_reason: billingReason,
        parent: {
          type: "subscription_details",
          subscription_details: { subscription: "sub_123" },
        },
      },
    },
  };
}

function createSubscriptionEvent({
  id = "evt_subscription_123",
  type = "customer.subscription.updated",
  customer = "cus_123",
  cancelAtPeriodEnd = true,
  cancelAt = null,
  previousAttributes = { cancel_at_period_end: false },
} = {}) {
  return {
    id,
    type,
    data: {
      object: {
        customer,
        cancel_at_period_end: cancelAtPeriodEnd,
        cancel_at: cancelAt,
        current_period_end: Date.UTC(2026, 11, 1) / 1000,
      },
      previous_attributes: previousAttributes,
    },
  };
}

describe("Stripe checkout webhook processing", () => {
  it("maps a paid checkout, invalidates access, and sends a confirmation", async () => {
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
    expect(calls.customerOwnerLookups).toEqual(["cus_123"]);
    expect(calls.lifecycleNotifications).toMatchObject([
      {
        email: "app@example.com",
        eventId: "evt_checkout_123",
        eventType: "checkout.session.completed",
        content: { subject: "Your subscription is confirmed" },
      },
    ]);
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
    expect(calls.lifecycleNotifications).toHaveLength(1);
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

describe("Stripe subscription lifecycle webhook processing", () => {
  it("sends a renewal notification for a subscription-cycle invoice without invalidating access", async () => {
    const { calls, dependencies } = createMemoryDependencies();

    await expect(
      processStripeWebhookEvent(createInvoiceEvent(), dependencies),
    ).resolves.toMatchObject({
      status: "executed",
      value: { userId: "user_123" },
    });

    expect(calls.customerOwnerLookups).toEqual(["cus_123"]);
    expect(calls.lifecycleNotifications).toHaveLength(1);
    expect(calls.lifecycleNotifications[0]).toMatchObject({
      email: "app@example.com",
      eventId: "evt_invoice_123",
      eventType: "invoice.paid",
      content: { subject: "Your subscription payment was received" },
    });
    expect(calls.cacheInvalidations).toEqual([]);
  });

  it("ignores initial subscription invoices rather than sending renewal notices", async () => {
    const { calls, dependencies } = createMemoryDependencies();

    for (const event of [
      createInvoiceEvent({ billingReason: "subscription_create" }),
      createInvoiceEvent({
        type: "invoice.payment_failed",
        billingReason: "subscription_create",
      }),
    ]) {
      await expect(
        processStripeWebhookEvent(event, dependencies),
      ).resolves.toEqual({ status: "ignored" });
    }

    expect(calls.customerOwnerLookups).toEqual([]);
    expect(calls.lifecycleNotifications).toEqual([]);
    expect(calls.cacheInvalidations).toEqual([]);
  });

  it("sends a payment-failure notice for a failed renewal", async () => {
    const { calls, dependencies } = createMemoryDependencies();

    await processStripeWebhookEvent(
      createInvoiceEvent({
        id: "evt_invoice_failed",
        type: "invoice.payment_failed",
      }),
      dependencies,
    );

    expect(calls.lifecycleNotifications).toMatchObject([
      {
        email: "app@example.com",
        eventType: "invoice.payment_failed",
        content: { subject: "Your subscription payment failed" },
      },
    ]);
    expect(calls.cacheInvalidations).toEqual([]);
  });

  it("notifies only when a cancellation is newly scheduled", async () => {
    const { calls, dependencies } = createMemoryDependencies();
    const event = createSubscriptionEvent();

    await processStripeWebhookEvent(event, dependencies);
    await expect(
      processStripeWebhookEvent(
        createSubscriptionEvent({
          id: "evt_subscription_unrelated",
          previousAttributes: { status: "active" },
        }),
        dependencies,
      ),
    ).resolves.toEqual({ status: "ignored" });

    expect(calls.lifecycleNotifications).toHaveLength(1);
    expect(calls.lifecycleNotifications[0]).toMatchObject({
      email: "app@example.com",
      eventType: "customer.subscription.updated",
      content: {
        subject: "Your subscription cancellation is scheduled",
        text: expect.stringContaining("2026-12-01"),
      },
    });
    expect(calls.cacheInvalidations).toEqual([]);
  });

  it("notifies when the subscription is deleted without invalidating paid-through access", async () => {
    const { calls, dependencies } = createMemoryDependencies();

    await processStripeWebhookEvent(
      createSubscriptionEvent({
        id: "evt_subscription_deleted",
        type: "customer.subscription.deleted",
        previousAttributes: {},
      }),
      dependencies,
    );

    expect(calls.lifecycleNotifications).toMatchObject([
      {
        email: "app@example.com",
        eventType: "customer.subscription.deleted",
        content: { subject: "Your subscription has ended" },
      },
    ]);
    expect(calls.cacheInvalidations).toEqual([]);
  });

  it("does not resend lifecycle notifications for duplicate events", async () => {
    const { calls, dependencies } = createMemoryDependencies();
    const event = createInvoiceEvent();

    await processStripeWebhookEvent(event, dependencies);
    await expect(
      processStripeWebhookEvent(event, dependencies),
    ).resolves.toMatchObject({ status: "duplicate" });

    expect(calls.lifecycleNotifications).toHaveLength(1);
  });

  it("fails rather than using Stripe email when the customer has no app mapping", async () => {
    const { calls, dependencies } = createMemoryDependencies({ user: null });

    await expect(
      processStripeWebhookEvent(createInvoiceEvent(), dependencies),
    ).rejects.toThrow("unmapped customer");

    expect(calls.lifecycleNotifications).toEqual([]);
    expect(calls.cacheInvalidations).toEqual([]);
  });
});
