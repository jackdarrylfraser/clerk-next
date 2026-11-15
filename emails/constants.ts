const RESEND = "resend";

export const EMAIL_EVENTS = {
  subscriptionCreated: "subscription.created",
  paymentFailed: "payment.failed",
  subscriptionCanceled: "subscription.canceled",
  marketingOptIn: "marketing.opted_in",
} as const;

export const IDEMPOTENCY_PREFIXES = {
  subscriptionCreated: `${RESEND}/${EMAIL_EVENTS.subscriptionCreated}`,
  paymentFailed: `${RESEND}/${EMAIL_EVENTS.paymentFailed}`,
  subscriptionCanceled: `${RESEND}/${EMAIL_EVENTS.subscriptionCanceled}`,
  marketingOptIn: `${RESEND}/${EMAIL_EVENTS.marketingOptIn}`,
} as const;
