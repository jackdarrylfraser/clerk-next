import type { IdempotencyKey } from "@clerk-next/kv";
import { env } from "@/env";
import { IDEMPOTENCY_SCOPES, idempotency } from "@/lib/kv";
import { Resend } from "resend";
import {
  createPaymentFailedEmail,
  createSubscriptionCanceledEmail,
  createSubscriptionCreatedEmail,
} from "./billing-notification-content";

const resend = new Resend(env.RESEND_API_KEY);

export type BillingNotificationResult =
  | { status: "sent" | "duplicate" }
  | { status: "in-progress"; retryAfterSeconds: number };

type BillingEmail = {
  idempotencyKey: IdempotencyKey;
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
}: SubscriptionCreatedEmail): Promise<BillingNotificationResult> {
  return sendBillingEmail({
    idempotencyKey: {
      scope: IDEMPOTENCY_SCOPES.billingSubscriptionCreated,
      key: `subscription-created/${subscriptionId}`,
    },
    email,
    content: createSubscriptionCreatedEmail({ firstName, planName }),
  });
}

export async function sendPaymentFailedEmail({
  paymentAttemptId,
  email,
  firstName,
  planName,
}: PaymentFailedEmail): Promise<BillingNotificationResult> {
  return sendBillingEmail({
    idempotencyKey: {
      scope: IDEMPOTENCY_SCOPES.billingPaymentFailed,
      key: `payment-failed/${paymentAttemptId}`,
    },
    email,
    content: createPaymentFailedEmail({ firstName, planName }),
  });
}

export async function sendSubscriptionCanceledEmail({
  subscriptionItemId,
  email,
  firstName,
  planName,
}: SubscriptionCanceledEmail): Promise<BillingNotificationResult> {
  return sendBillingEmail({
    idempotencyKey: {
      scope: IDEMPOTENCY_SCOPES.billingSubscriptionCanceled,
      key: `subscription-canceled/${subscriptionItemId}`,
    },
    email,
    content: createSubscriptionCanceledEmail({ firstName, planName }),
  });
}

async function sendBillingEmail(
  { idempotencyKey, email, content }: BillingEmail,
): Promise<BillingNotificationResult> {
  const from = env.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    throw new Error("RESEND_FROM_EMAIL is required to send billing emails");
  }

  const claim = await idempotency.begin(idempotencyKey);
  if (claim.status === "completed") {
    return { status: "duplicate" };
  }

  if (claim.status === "in-progress") {
    return {
      status: "in-progress",
      retryAfterSeconds: claim.retryAfterSeconds,
    };
  }

  const { data, error } = await resend.emails.send(
    {
      from,
      to: email.trim(),
      ...content,
    },
    {
      idempotencyKey: `clerk-next/${idempotencyKey.key}`,
    },
  );

  if (error) {
    throw new Error(`Resend could not send billing email: ${error.message}`);
  }

  if (!data) {
    throw new Error("Resend did not confirm the billing email");
  }

  const completed = await idempotency.end(idempotencyKey, claim.token, {
    ttlSeconds: 31_536_000,
  });
  if (!completed) {
    throw new Error("Billing email idempotency claim expired before completion");
  }

  return { status: "sent" };
}
