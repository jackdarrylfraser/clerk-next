export type BillingNotificationContent = {
  subject: string;
  text: string;
  html: string;
};

type BillingNotificationDetails = {
  firstName?: string;
  planName?: string;
};

export function createSubscriptionCreatedEmail({
  firstName,
  planName,
}: BillingNotificationDetails): BillingNotificationContent {
  const plan = getPlanDescription(planName);
  const sentence = `Your ${plan} has been created.`;
  return createEmailContent({
    firstName,
    subject: "Your subscription is confirmed",
    sentence,
  });
}

export function createPaymentFailedEmail({
  firstName,
  planName,
}: BillingNotificationDetails): BillingNotificationContent {
  const plan = getPlanDescription(planName);
  const sentence = `We couldn't process a payment for your ${plan}. Please review your billing details in your account.`;
  return createEmailContent({
    firstName,
    subject: "Your payment couldn't be processed",
    sentence,
  });
}

export function createSubscriptionCanceledEmail({
  firstName,
  planName,
}: BillingNotificationDetails): BillingNotificationContent {
  const plan = getPlanDescription(planName);
  const sentence = `The ${plan} item has been canceled.`;
  return createEmailContent({
    firstName,
    subject: "A subscription item has been canceled",
    sentence,
  });
}

export function createSubscriptionRenewedEmail({
  firstName,
  planName,
}: BillingNotificationDetails): BillingNotificationContent {
  const plan = getPlanDescription(planName);
  return createEmailContent({
    firstName,
    subject: "Your subscription payment was received",
    sentence: `Your ${plan} renewal payment was received. Your access remains available through any period you've already paid for.`,
  });
}

export function createSubscriptionPaymentFailedEmail({
  firstName,
  planName,
}: BillingNotificationDetails): BillingNotificationContent {
  const plan = getPlanDescription(planName);
  return createEmailContent({
    firstName,
    subject: "Your subscription payment failed",
    sentence: `We couldn't process a renewal payment for your ${plan}. Your access remains based on any period you've already paid for.`,
  });
}

export function createCancellationScheduledEmail({
  firstName,
  planName,
  cancellationDate,
}: BillingNotificationDetails & {
  cancellationDate?: string;
}): BillingNotificationContent {
  const plan = getPlanDescription(planName);
  const ending = cancellationDate
    ? `Your ${plan} is scheduled to end on ${cancellationDate}.`
    : `Your ${plan} is scheduled to end.`;
  return createEmailContent({
    firstName,
    subject: "Your subscription cancellation is scheduled",
    sentence: `${ending} Your access remains available through any period you've already paid for.`,
  });
}

export function createSubscriptionEndedEmail({
  firstName,
  planName,
}: BillingNotificationDetails): BillingNotificationContent {
  const plan = getPlanDescription(planName);
  return createEmailContent({
    firstName,
    subject: "Your subscription has ended",
    sentence: `Your ${plan} has ended. Your access remains available through any period you've already paid for.`,
  });
}

function getPlanDescription(planName?: string): string {
  const normalizedPlanName = planName?.trim();
  return normalizedPlanName
    ? `${normalizedPlanName} subscription`
    : "subscription";
}

function createEmailContent({
  firstName,
  subject,
  sentence,
}: BillingNotificationDetails & {
  subject: string;
  sentence: string;
}): BillingNotificationContent {
  const normalizedFirstName = firstName?.trim();
  const greeting = normalizedFirstName
    ? `Hello ${normalizedFirstName},`
    : "Hello,";

  return {
    subject,
    text: `${greeting}\n\n${sentence}`,
    html: `<p>${escapeHtml(greeting)}</p>\n<p>${escapeHtml(sentence)}</p>`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
