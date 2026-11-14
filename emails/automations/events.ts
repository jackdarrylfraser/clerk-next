import { env } from "@/env";
import { IDEMPOTENCY_SCOPES, idempotency } from "@/lib/kv";
import { Resend } from "resend";

const resend = new Resend(env.RESEND_API_KEY);

export type AutomationEventResult =
  | { status: "sent" | "duplicate" }
  | { status: "in-progress"; retryAfterSeconds: number };

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
  const idempotencyKey = {
    scope: IDEMPOTENCY_SCOPES.marketingOptInEvent,
    key: `marketing-opt-in/${submissionId}`,
  };
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

  const completed = await idempotency.end(
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
