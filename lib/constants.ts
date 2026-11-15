// Change this only when intentionally invalidating idempotency entries, and keep
// the new value so a later reset does not reactivate older Redis entries.
const IDEMPOTENCY_CACHE_RESET_NAMESPACE = "";
const SCOPE = {
  RESEND: "resend",
  STRIPE: "stripe",
} as const;

const EVENTS = {
  subscriptionCreated: "subscription.created",
  paymentFailed: "payment.failed",
  subscriptionCanceled: "subscription.canceled",
  marketingOptIn: "marketing.opted_in",
  provisioning: "account.provisioning",
  notification: "email.notification",
} as const;

function createIdempotencyScope(scope: string, event: string) {
  return `${IDEMPOTENCY_CACHE_RESET_NAMESPACE}/${scope}/${event}`;
}

export const IDEMPOTENCY_PREFIXES = {
  subscriptionCreated: createIdempotencyScope(
    SCOPE.RESEND,
    EVENTS.subscriptionCreated,
  ),
  paymentFailed: createIdempotencyScope(SCOPE.RESEND, EVENTS.paymentFailed),
  subscriptionCanceled: createIdempotencyScope(
    SCOPE.RESEND,
    EVENTS.subscriptionCanceled,
  ),
  marketingOptIn: createIdempotencyScope(SCOPE.RESEND, EVENTS.marketingOptIn),
  stripeCheckoutProvisioning: createIdempotencyScope(
    SCOPE.STRIPE,
    EVENTS.provisioning,
  ),
  stripeLifecycleNotification: createIdempotencyScope(
    SCOPE.STRIPE,
    EVENTS.notification,
  ),
} as const;
