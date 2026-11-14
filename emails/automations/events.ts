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

  async function sendMarketingOptInEventToResend(): Promise<void> {
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
  }

  const result = await idempotency.run(
    idempotencyKey,
    sendMarketingOptInEventToResend,
  );

  if (result.status === "executed") {
    return { status: "sent" };
  }

  return result;
}
