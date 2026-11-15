import { describe, expect, test } from "bun:test";
import {
  checkStripeAccess,
  getSubscriptionAccessExpiry,
  invalidateStripeAccessCache,
  hasSubscriptionAccess,
} from "./stripe-access-policy.ts";

function createMemoryIdempotency(now = () => 1_000) {
  const values = new Map();
  const ttlSeconds = new Map();
  const deletedKeys = [];

  return {
    values,
    ttlSeconds,
    deletedKeys,
    async run(config, operation) {
      const cacheKey = `${config.scope}:${config.key}`;
      const current = values.get(cacheKey);
      if (current && current.expiresAt > now()) {
        return { status: "duplicate", value: current.value };
      }
      if (current) {
        values.delete(cacheKey);
      }

      let value;
      try {
        value = await operation();
      } catch (error) {
        return { status: "error", error };
      }

      const ttl = config.resultTtlSeconds(value);
      values.set(cacheKey, { value, expiresAt: now() + ttl });
      ttlSeconds.set(cacheKey, ttl);
      return { status: "executed", value };
    },
    async forget(key) {
      const cacheKey = `${key.scope}:${key.key}`;
      deletedKeys.push(cacheKey);
      values.delete(cacheKey);
    },
  };
}

describe("Stripe subscription access policy", () => {
  test("grants access through a paid invoice period", () => {
    expect(
      hasSubscriptionAccess(
        { status: "active", trialEnd: null, paidThrough: 1_100 },
        1_000,
      ),
    ).toBe(true);
    expect(
      hasSubscriptionAccess(
        { status: "past_due", trialEnd: null, paidThrough: 1_100 },
        1_000,
      ),
    ).toBe(true);
  });

  test("grants access during an active trial", () => {
    expect(
      hasSubscriptionAccess(
        { status: "trialing", trialEnd: 1_100, paidThrough: null },
        1_000,
      ),
    ).toBe(true);
    expect(
      getSubscriptionAccessExpiry(
        { status: "trialing", trialEnd: 1_100, paidThrough: 1_200 },
        1_000,
      ),
    ).toBe(1_200);
  });

  test("denies access after the paid period or trial ends", () => {
    expect(
      hasSubscriptionAccess(
        { status: "canceled", trialEnd: null, paidThrough: 900 },
        1_000,
      ),
    ).toBe(false);
    expect(
      hasSubscriptionAccess(
        { status: "trialing", trialEnd: 900, paidThrough: null },
        1_000,
      ),
    ).toBe(false);
    expect(
      hasSubscriptionAccess(
        { status: "incomplete", trialEnd: null, paidThrough: null },
        1_000,
      ),
    ).toBe(false);
    expect(
      getSubscriptionAccessExpiry(
        { status: "trialing", trialEnd: 1_100, paidThrough: null },
        1_100,
      ),
    ).toBe(null);
  });
});

describe("Stripe access lookup and idempotency cache", () => {
  test("uses the longest valid access window across mapped customers", async () => {
    const idempotency = createMemoryIdempotency();
    const dependencies = {
      getCustomerIds: async () => ["cus_first", "cus_second"],
      getAccessStates: async (customerId) =>
        customerId === "cus_first"
          ? [{ status: "active", trialEnd: null, paidThrough: 1_100 }]
          : [{ status: "trialing", trialEnd: 1_200, paidThrough: null }],
      idempotency,
      now: () => 1_000,
    };

    await expect(checkStripeAccess("user_1", dependencies)).resolves.toBe(true);
    expect(
      idempotency.ttlSeconds.get("stripe-access:v1:user_1"),
    ).toBe(200);
    expect(
      idempotency.values.get("stripe-access:v1:user_1").value,
    ).toEqual({ hasAccess: true, expiresAt: 1_200 });
  });

  test("reuses denied results for the short default TTL", async () => {
    const idempotency = createMemoryIdempotency();
    let customerLookups = 0;
    const dependencies = {
      getCustomerIds: async () => {
        customerLookups += 1;
        return [];
      },
      getAccessStates: async () => [],
      idempotency,
      now: () => 1_000,
    };

    await expect(checkStripeAccess("user_1", dependencies)).resolves.toBe(false);
    await expect(checkStripeAccess("user_1", dependencies)).resolves.toBe(false);
    expect(customerLookups).toBe(1);
    expect(
      idempotency.ttlSeconds.get("stripe-access:v1:user_1"),
    ).toBe(60);
  });

  test("does not grant access from an expired positive result", async () => {
    let currentTime = 1_000;
    const idempotency = createMemoryIdempotency(() => currentTime);
    const dependencies = {
      getCustomerIds: async () => ["cus_first"],
      getAccessStates: async () => [
        { status: "active", trialEnd: null, paidThrough: 1_100 },
      ],
      idempotency,
      now: () => currentTime,
    };

    await expect(checkStripeAccess("user_1", dependencies)).resolves.toBe(true);
    currentTime = 1_100;
    await expect(checkStripeAccess("user_1", dependencies)).resolves.toBe(false);
  });

  test("invalidates the user's cached result", async () => {
    const idempotency = createMemoryIdempotency();

    await invalidateStripeAccessCache("user_1", idempotency);
    expect(idempotency.deletedKeys).toEqual(["stripe-access:v1:user_1"]);
  });

  test("does not start another Stripe lookup when the lock owner is still working", async () => {
    const idempotency = createMemoryIdempotency();
    idempotency.run = async () => ({
      status: "in-progress",
      retryAfterSeconds: 1,
    });
    let accessStateLookups = 0;
    const dependencies = {
      getCustomerIds: async () => ["cus_first"],
      getAccessStates: async () => {
        accessStateLookups += 1;
        return [{ status: "active", trialEnd: null, paidThrough: 1_100 }];
      },
      idempotency,
      now: () => 1_000,
    };

    await expect(checkStripeAccess("user_1", dependencies)).rejects.toThrow(
      "Stripe access lookup is still in progress",
    );
    expect(accessStateLookups).toBe(0);
  });

  test("surfaces Stripe and idempotency failures without granting access", async () => {
    const stripeFailure = new Error("Stripe unavailable");
    const stripeFailureDependencies = {
      getCustomerIds: async () => ["cus_first"],
      getAccessStates: async () => {
        throw stripeFailure;
      },
      idempotency: createMemoryIdempotency(),
      now: () => 1_000,
    };
    await expect(
      checkStripeAccess("user_1", stripeFailureDependencies),
    ).rejects.toBe(stripeFailure);

    const redisFailure = new Error("Redis unavailable");
    const redisFailureDependencies = {
      getCustomerIds: async () => [],
      getAccessStates: async () => [],
      idempotency: {
        async run() {
          throw redisFailure;
        },
        async forget() {},
      },
      now: () => 1_000,
    };
    await expect(
      checkStripeAccess("user_1", redisFailureDependencies),
    ).rejects.toBe(redisFailure);
  });
});
