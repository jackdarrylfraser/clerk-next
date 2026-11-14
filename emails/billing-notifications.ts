import {
  createPaymentFailedEmail,
  createSubscriptionCanceledEmail,
  createSubscriptionCreatedEmail,
} from "./billing-notification-content";
import { IDEMPOTENCY_PREFIXES } from "./constants";
import { sendEmail } from "./send-email";

type SubscriptionCreatedEmail = {
  subscriptionId: string;
  email: string;
  firstName?: string;
  planName?: string;
};

type PaymentFailedEmail = {
  paymentAttemptId: string;
  email: string;
  firstName?: string;
  planName?: string;
};

type SubscriptionCanceledEmail = {
  subscriptionItemId: string;
  email: string;
  firstName?: string;
  planName?: string;
};

export async function sendSubscriptionCreatedEmail({
  subscriptionId,
  email,
  firstName,
  planName,
}: SubscriptionCreatedEmail): Promise<void> {
  return sendEmail({
    idempotencyKey: `${IDEMPOTENCY_PREFIXES.subscriptionCreated}/${subscriptionId}`,
    to: email,
    content: createSubscriptionCreatedEmail({ firstName, planName }),
  });
}

export async function sendPaymentFailedEmail({
  paymentAttemptId,
  email,
  firstName,
  planName,
}: PaymentFailedEmail): Promise<void> {
  return sendEmail({
    idempotencyKey: `${IDEMPOTENCY_PREFIXES.paymentFailed}/${paymentAttemptId}`,
    to: email,
    content: createPaymentFailedEmail({ firstName, planName }),
  });
}

export async function sendSubscriptionCanceledEmail({
  subscriptionItemId,
  email,
  firstName,
  planName,
}: SubscriptionCanceledEmail): Promise<void> {
  return sendEmail({
    idempotencyKey: `${IDEMPOTENCY_PREFIXES.subscriptionCanceled}/${subscriptionItemId}`,
    to: email,
    content: createSubscriptionCanceledEmail({ firstName, planName }),
  });
}
