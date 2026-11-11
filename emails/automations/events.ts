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
const contactSubmittedIdempotency = createIdempotencyStore({
  getRedisClient,
  prefix: "clerk-next:resend-event:contact-submitted",
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
    throw new Error(`Resend could not trigger subscription automations: ${error.message}`);
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
    throw new Error("Subscription automation idempotency claim expired before completion");
  }

  return { status: "sent" };
}

type ContactSubmittedEvent = {
  email: string;
  firstName: string;
  lastName: string;
};

export async function sendContactSubmittedEvent({
  email,
  firstName,
  lastName,
}: ContactSubmittedEvent): Promise<AutomationEventResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const idempotencyKey = `contact-submitted/${normalizedEmail}`;
  const claim = await contactSubmittedIdempotency.begin(idempotencyKey);

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
    event: "contact.submitted",
    email: normalizedEmail,
    payload: {
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (error) {
    throw new Error(`Resend could not trigger contact automations: ${error.message}`);
  }

  if (!data) {
    throw new Error("Resend did not confirm the contact automation event");
  }

  const completed = await contactSubmittedIdempotency.complete(
    idempotencyKey,
    claim.token,
    { ttlSeconds: 31_536_000 },
  );
  if (!completed) {
    throw new Error("Contact automation idempotency claim expired before completion");
  }

  return { status: "sent" };
}
