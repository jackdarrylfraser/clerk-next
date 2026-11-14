import { env } from "@/env";
import { idempotency } from "@/lib/kv";
import { Resend } from "resend";
import { EMAIL_EVENTS, IDEMPOTENCY_PREFIXES } from "../constants";

const resend = new Resend(env.RESEND_API_KEY);

export type AutomationEventResult =
  | { status: "sent" | "duplicate" }
  | { status: "in-progress"; retryAfterSeconds: number };

type MarketingOptInEvent = {
  email: string;
  firstName: string;
  lastName: string;
};

export async function sendMarketingOptInEvent({
  email,
  firstName,
  lastName,
}: MarketingOptInEvent): Promise<AutomationEventResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const idempotencyKey = {
    scope: IDEMPOTENCY_PREFIXES.marketingOptIn,
    key: normalizedEmail,
  };

  async function sendMarketingOptInEventToResend(): Promise<void> {
    const { data, error } = await resend.events.send({
      event: EMAIL_EVENTS.marketingOptIn,
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
