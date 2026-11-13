import { createIdempotencyStore, createRedisClient } from "@clerk-next/kv";
import { env } from "@/env";
import { Resend } from "resend";

const resend = new Resend(env.RESEND_API_KEY);
const getRedisClient = createRedisClient({
  redisUrl: env.UPSTASH_REDIS_REST_URL,
  redisToken: env.UPSTASH_REDIS_REST_TOKEN,
});
const subscriptionCreatedIdempotency = createIdempotencyStore({
  getRedisClient,
  prefix: "clerk-next:resend-event:subscription-created",
});
const marketingOptInIdempotency = createIdempotencyStore({
  getRedisClient,
  prefix: "clerk-next:resend-event:marketing-opt-in",
});

type SubscriptionCreatedEvent = {
  subscriptionId: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

export type AutomationEventResult =
  | { status: "sent" | "duplicate" }
  | { status: "in-progress"; retryAfterSeconds: number };

export async function sendSubscriptionCreatedEvent({
  subscriptionId,
  email,
  firstName,
  lastName,
}: SubscriptionCreatedEvent): Promise<AutomationEventResult> {
  const idempotencyKey = `subscription-created/${subscriptionId}`;
  const claim = await subscriptionCreatedIdempotency.begin(idempotencyKey);

  if (claim.status === "completed") {
    return { status: "duplicate" };
  }

  if (claim.status === "in-progress") {
    return {
      status: "in-progress",
      retryAfterSeconds: claim.retryAfterSeconds,
    };
  }

  const { data, error } = await resend.events.send({
    event: "subscription.created",
    email: email.trim(),
    payload: {
      subscription_id: subscriptionId,
      first_name: firstName ?? "",
      last_name: lastName ?? "",
    },
  });

  if (error) {
    throw new Error(
      `Resend could not trigger subscription automations: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error("Resend did not confirm the subscription automation event");
  }

  const completed = await subscriptionCreatedIdempotency.complete(
    idempotencyKey,
    claim.token,
    { ttlSeconds: 31_536_000 },
  );
  if (!completed) {
    throw new Error(
      "Subscription automation idempotency claim expired before completion",
    );
  }

  return { status: "sent" };
}

type MarketingOptInEvent = {
  submissionId: string;
  email: string;
  firstName: string;
  lastName: string;
};

export async function sendMarketingOptInEvent({
  submissionId,
  email,
  firstName,
  lastName,
}: MarketingOptInEvent): Promise<AutomationEventResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const idempotencyKey = `marketing-opt-in/${submissionId}`;
  const claim = await marketingOptInIdempotency.begin(idempotencyKey);

  if (claim.status === "completed") {
    return { status: "duplicate" };
  }

  if (claim.status === "in-progress") {
    return {
      status: "in-progress",
      retryAfterSeconds: claim.retryAfterSeconds,
    };
  }

  const { data, error } = await resend.events.send({
    event: "marketing.opted_in",
    email: normalizedEmail,
    payload: {
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (error) {
    throw new Error(
      `Resend could not trigger the marketing automation: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error("Resend did not confirm the marketing automation event");
  }

  const completed = await marketingOptInIdempotency.complete(
    idempotencyKey,
    claim.token,
    { ttlSeconds: 31_536_000 },
  );
  if (!completed) {
    throw new Error(
      "Marketing automation idempotency claim expired before completion",
    );
  }

  return { status: "sent" };
}
