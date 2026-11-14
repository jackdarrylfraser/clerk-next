import { env } from "@/env";
import { IDEMPOTENCY_SCOPES, idempotency } from "@/lib/kv";
import { Resend } from "resend";
import { AUTOMATION_EVENTS } from "./constants";

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
    scope: IDEMPOTENCY_SCOPES.marketingOptInEvent,
    key: `${AUTOMATION_EVENTS.marketingOptIn}/${normalizedEmail}`,
  };

  async function sendMarketingOptInEventToResend(): Promise<void> {
    const { data, error } = await resend.events.send({
      event: AUTOMATION_EVENTS.marketingOptIn,
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
