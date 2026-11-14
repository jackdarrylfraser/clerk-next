import { createIdempotencyStore, createRedisClient } from "@clerk-next/kv";
import { env } from "@/env";

export const IDEMPOTENCY_SCOPES = {
  billingSubscriptionCreated: "clerk-next:resend-email:subscription-created",
  billingPaymentFailed: "clerk-next:resend-email:payment-failed",
  billingSubscriptionCanceled: "clerk-next:resend-email:subscription-canceled",
  marketingOptInEvent: "clerk-next:resend-event:marketing-opt-in",
} as const;

export const getRedisClient = createRedisClient({
  redisUrl: env.UPSTASH_REDIS_REST_URL,
  redisToken: env.UPSTASH_REDIS_REST_TOKEN,
});

export const idempotency = createIdempotencyStore({ getRedisClient });
