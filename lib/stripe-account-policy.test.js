import { describe, expect, it } from "bun:test";
import {
  canManageStripeSubscription,
  getLatestPeriodEnd,
  getStripeResourceId,
  isCancellationScheduled,
  isStripeCustomerMappedToUser,
  isSubscriptionOwnedByCustomer,
} from "./stripe-account-policy.ts";

describe("Stripe account ownership policy", () => {
  it("only accepts customer IDs explicitly mapped to the signed-in user", () => {
    expect(isStripeCustomerMappedToUser(["cus_owned"], "cus_owned")).toBe(true);
    expect(isStripeCustomerMappedToUser(["cus_other"], "cus_owned")).toBe(false);
    expect(isStripeCustomerMappedToUser([], "cus_owned")).toBe(false);
  });

  it("compares the subscription's Stripe customer to the selected customer", () => {
    expect(getStripeResourceId({ id: "cus_owned" })).toBe("cus_owned");
    expect(getStripeResourceId("cus_owned")).toBe("cus_owned");
    expect(isSubscriptionOwnedByCustomer("cus_owned", "cus_owned")).toBe(true);
    expect(isSubscriptionOwnedByCustomer("cus_other", "cus_owned")).toBe(false);
    expect(isSubscriptionOwnedByCustomer(null, "cus_owned")).toBe(false);
  });

  it("allows period-end cancellation management only for current subscriptions", () => {
    expect(canManageStripeSubscription("active")).toBe(true);
    expect(canManageStripeSubscription("trialing")).toBe(true);
    expect(canManageStripeSubscription("past_due")).toBe(true);
    expect(canManageStripeSubscription("canceled")).toBe(false);
    expect(canManageStripeSubscription("incomplete_expired")).toBe(false);
  });

  it("distinguishes scheduled cancellations from ended subscriptions", () => {
    expect(isCancellationScheduled("active", true, null)).toBe(true);
    expect(isCancellationScheduled("active", false, 1_800_000_000)).toBe(true);
    expect(isCancellationScheduled("active", false, null)).toBe(false);
    expect(isCancellationScheduled("canceled", true, 1_800_000_000)).toBe(false);
    expect(isCancellationScheduled("incomplete_expired", true, null)).toBe(false);
  });

  it("selects the latest item period end for multi-item subscriptions", () => {
    expect(getLatestPeriodEnd([1_800_000_000, 1_900_000_000])).toBe(
      1_900_000_000,
    );
    expect(getLatestPeriodEnd([])).toBeNull();
  });
});
