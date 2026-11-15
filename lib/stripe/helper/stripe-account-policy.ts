export function isStripeCustomerMappedToUser(
  customerIds: readonly string[],
  customerId: string,
): boolean {
  return customerIds.includes(customerId);
}

export function getStripeResourceId(
  resource: string | { id: string } | null,
): string | null {
  if (typeof resource === "string") {
    return resource;
  }

  return resource?.id ?? null;
}

export function isSubscriptionOwnedByCustomer(
  subscriptionCustomerId: string | null,
  customerId: string,
): boolean {
  return subscriptionCustomerId === customerId;
}

export function canManageStripeSubscription(status: string): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

export function isCancellationScheduled(
  status: string,
  cancelAtPeriodEnd: boolean,
  cancelAt: number | null,
): boolean {
  return (
    status !== "canceled" &&
    status !== "incomplete_expired" &&
    (cancelAtPeriodEnd || cancelAt !== null)
  );
}

export function getLatestPeriodEnd(periodEnds: readonly number[]): number | null {
  if (periodEnds.length === 0) {
    return null;
  }

  return Math.max(...periodEnds);
}
