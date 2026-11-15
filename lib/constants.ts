// Change this only when intentionally invalidating idempotency entries, and keep
// the new value so a later reset does not reactivate older Redis entries.

//dont expose or export IDEMPOTENCY_CACHE_RESET_NAMESPACE outside the file
const IDEMPOTENCY_CACHE_RESET_NAMESPACE = "";

const SCOPE = {
  stripe: "stripe",
  resend: "resend",
  betterAuth: "better-auth",
};

const SEPARATOR = "/";

export const IDEMPOTENCY_PREFIXES = {
  namespace: IDEMPOTENCY_CACHE_RESET_NAMESPACE,
  resend: {
    events: {
      subscriptionCreated: {
        namespace: IDEMPOTENCY_CACHE_RESET_NAMESPACE,
        scope: SCOPE.resend,
        event: "subscription.created",
        separator: SEPARATOR,
      },
      paymentFailed: {
        namespace: IDEMPOTENCY_CACHE_RESET_NAMESPACE,
        scope: SCOPE.resend,
        event: "payment.failed",
        separator: SEPARATOR,
      },
      subscriptionCanceled: {
        namespace: IDEMPOTENCY_CACHE_RESET_NAMESPACE,
        scope: SCOPE.resend,
        event: "subscription.canceled",
        separator: SEPARATOR,
      },
      marketingOptIn: {
        namespace: IDEMPOTENCY_CACHE_RESET_NAMESPACE,
        scope: SCOPE.resend,
        event: "marketing.opted_in",
        separator: SEPARATOR,
      },
    },
  },
  stripe: {
    access: {
      namespace: IDEMPOTENCY_CACHE_RESET_NAMESPACE,
      event: "access",
      scope: SCOPE.stripe,
      separator: SEPARATOR,
    },
    checkoutProvisioning: {
      namespace: IDEMPOTENCY_CACHE_RESET_NAMESPACE,
      event: "checkout.provisioning",
      scope: SCOPE.stripe,
      separator: SEPARATOR,
    },
    lifecycleNotification: {
      namespace: IDEMPOTENCY_CACHE_RESET_NAMESPACE,
      scope: SCOPE.stripe,
      event: "email.notification",
      separator: SEPARATOR,
    },
    eventEmail: {
      namespace: IDEMPOTENCY_CACHE_RESET_NAMESPACE,
      event: "email.event",
      scope: SCOPE.stripe,
      separator: SEPARATOR,
    },
    catalog: {
      product: {
        namespace: IDEMPOTENCY_CACHE_RESET_NAMESPACE,
        scope: SCOPE.stripe,
        event: "catalog/product",
        separator: SEPARATOR,
      },
      price: {
        namespace: IDEMPOTENCY_CACHE_RESET_NAMESPACE,
        scope: SCOPE.stripe,
        event: "catalog/price",
        separator: SEPARATOR,
      },
    },
  },
  betterAuth: {
    otp: {
      namespace: IDEMPOTENCY_CACHE_RESET_NAMESPACE,
      scope: SCOPE.betterAuth,
      event: "otp",
      separator: SEPARATOR,
    },
    leadOtp: {
      namespace: IDEMPOTENCY_CACHE_RESET_NAMESPACE,
      scope: SCOPE.betterAuth,
      event: "lead-otp",
      separator: SEPARATOR,
    },
  },
} as const;
