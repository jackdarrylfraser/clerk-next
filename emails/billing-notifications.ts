import { env } from "@/env";
import { Resend } from "resend";
import {
  createPaymentFailedEmail,
  createSubscriptionCanceledEmail,
  createSubscriptionCreatedEmail,
} from "./billing-notification-content";

const resend = new Resend(env.RESEND_API_KEY);

type BillingEmail = {
  resendIdempotencyKey: string;
  email: string;
  content: {
    subject: string;
    text: string;
    html: string;
  };
};

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
  return sendBillingEmail({
    resendIdempotencyKey: `clerk-next/subscription-created/${subscriptionId}`,
    email,
    content: createSubscriptionCreatedEmail({ firstName, planName }),
  });
}

export async function sendPaymentFailedEmail({
  paymentAttemptId,
  email,
  firstName,
  planName,
}: PaymentFailedEmail): Promise<void> {
  return sendBillingEmail({
    resendIdempotencyKey: `clerk-next/payment-failed/${paymentAttemptId}`,
    email,
    content: createPaymentFailedEmail({ firstName, planName }),
  });
}

export async function sendSubscriptionCanceledEmail({
  subscriptionItemId,
  email,
  firstName,
  planName,
}: SubscriptionCanceledEmail): Promise<void> {
  return sendBillingEmail({
    resendIdempotencyKey: `clerk-next/subscription-canceled/${subscriptionItemId}`,
    email,
    content: createSubscriptionCanceledEmail({ firstName, planName }),
  });
}

async function sendBillingEmail(
  { resendIdempotencyKey, email, content }: BillingEmail,
): Promise<void> {
  const from = env.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    throw new Error("RESEND_FROM_EMAIL is required to send billing emails");
  }

  const { data, error } = await resend.emails.send(
    {
      from,
      to: email.trim(),
      ...content,
    },
    {
      idempotencyKey: resendIdempotencyKey,
    },
  );

  if (error) {
    throw new Error(`Resend could not send billing email: ${error.message}`);
  }

  if (!data) {
    throw new Error("Resend did not confirm the billing email");
  }
}
