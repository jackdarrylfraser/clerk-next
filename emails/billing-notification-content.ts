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
