import { createIdempotencyStore, createRedisClient } from "@clerk-next/kv";
import { env } from "@/env";
import { Resend } from "resend";
import {
  createPaymentFailedEmail,
  createSubscriptionCanceledEmail,
  createSubscriptionCreatedEmail,
} from "./billing-notification-content";

const resend = new Resend(env.RESEND_API_KEY);
const getRedisClient = createRedisClient({
  redisUrl: env.UPSTASH_REDIS_REST_URL,
  redisToken: env.UPSTASH_REDIS_REST_TOKEN,
});
const subscriptionCreatedIdempotency = createIdempotencyStore({
  getRedisClient,
  prefix: "clerk-next:resend-email:subscription-created",
});
const paymentFailedIdempotency = createIdempotencyStore({
  getRedisClient,
  prefix: "clerk-next:resend-email:payment-failed",
});
const subscriptionCanceledIdempotency = createIdempotencyStore({
  getRedisClient,
  prefix: "clerk-next:resend-email:subscription-canceled",
});

export type BillingNotificationResult =
  | { status: "sent" | "duplicate" }
  | { status: "in-progress"; retryAfterSeconds: number };

type IdempotencyStore = ReturnType<typeof createIdempotencyStore>;

type BillingEmail = {
  idempotencyKey: string;
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
  return sendBillingEmail(subscriptionCreatedIdempotency, {
    idempotencyKey: `subscription-created/${subscriptionId}`,
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
  return sendBillingEmail(paymentFailedIdempotency, {
    idempotencyKey: `payment-failed/${paymentAttemptId}`,
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
  return sendBillingEmail(subscriptionCanceledIdempotency, {
    idempotencyKey: `subscription-canceled/${subscriptionItemId}`,
    email,
    content: createSubscriptionCanceledEmail({ firstName, planName }),
  });
}

async function sendBillingEmail(
  idempotency: IdempotencyStore,
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
    { idempotencyKey: `clerk-next/${idempotencyKey}` },
  );

  if (error) {
    throw new Error(`Resend could not send billing email: ${error.message}`);
  }

  if (!data) {
    throw new Error("Resend did not confirm the billing email");
  }

  const completed = await idempotency.complete(idempotencyKey, claim.token, {
    ttlSeconds: 31_536_000,
  });
  if (!completed) {
    throw new Error("Billing email idempotency claim expired before completion");
  }

  return { status: "sent" };
}
