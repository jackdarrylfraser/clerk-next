import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { IdempotencyRunResult } from "@clerk-next/kv";
import {
  createPaymentFailedEmail,
  createSubscriptionCanceledEmail,
  createSubscriptionCreatedEmail,
} from "@/emails/billing-notification-content";
import { EMAIL_EVENTS, IDEMPOTENCY_PREFIXES } from "@/emails/constants";
import { sendEmail } from "@/emails/send-email";
import { env } from "@/env";
import type { NextRequest } from "next/server";
import { idempotency } from "@/lib/kv";

type ClerkWebhookEvent = Awaited<ReturnType<typeof verifyWebhook>>;
type BillingNotificationResult = Exclude<
  IdempotencyRunResult<void>,
  { status: "error" }
>;

export async function POST(request: NextRequest): Promise<Response> {
  const secretResponse = checkWebhookSigningSecret();
  const verifiedEvent = await verifyClerkWebhook(request, secretResponse);
  if (verifiedEvent instanceof Response) {
    return verifiedEvent;
  }

  const notificationResult = await deliverBillingNotification(verifiedEvent);
  return createWebhookResponse(notificationResult);
}

function checkWebhookSigningSecret(): Response | undefined {
  if (!env.CLERK_WEBHOOK_SIGNING_SECRET) {
    console.error("Clerk webhook signing secret is not configured");
    return new Response("Webhook signing secret is not configured", {
      status: 500,
    });
  }

  return undefined;
}

async function verifyClerkWebhook(
  request: NextRequest,
  previousResponse?: Response,
): Promise<ClerkWebhookEvent | Response> {
  if (previousResponse) {
    return previousResponse;
  }

  try {
    return await verifyWebhook(request);
  } catch (error) {
    console.error("Clerk webhook verification failed", error);
    return new Response("Webhook verification failed", { status: 400 });
  }
}

async function deliverBillingNotification(
  event: ClerkWebhookEvent,
): Promise<BillingNotificationResult | Response> {
  if (event.type === EMAIL_EVENTS.subscriptionCreated) {
    if (!event.data.payer.user_id) {
      return ignoredEventResponse();
    }

    const email = getPayerEmail(
      event.data.payer.email,
      event.data.id,
      "subscription-created",
    );
    if (email instanceof Response) {
      return email;
    }

    const subscriptionId = event.data.id;
    const recipientEmail: string = email;
    const firstName = event.data.payer.first_name;
    const planName = event.data.items[0]?.plan?.name;

    const result = await idempotency.run(
      {
        scope: IDEMPOTENCY_PREFIXES.subscriptionCreated,
        key: subscriptionId,
      },
      () =>
        sendEmail({
          idempotencyKey: `${IDEMPOTENCY_PREFIXES.subscriptionCreated}/${subscriptionId}`,
          to: recipientEmail,
          content: createSubscriptionCreatedEmail({ firstName, planName }),
        }),
    );
    if (result.status === "error") {
      console.error(
        "Unable to send subscription-created billing notification",
        result.error,
      );
      return new Response("Billing notification delivery failed", {
        status: 500,
      });
    }
    return result;
  }

  if (
    event.type === "paymentAttempt.created" ||
    event.type === "paymentAttempt.updated"
  ) {
    const payer = event.data.payer;
    if (event.data.status !== "failed" || !payer?.user_id) {
      return ignoredEventResponse();
    }

    const email = getPayerEmail(payer.email, event.data.id, "payment-failed");
    if (email instanceof Response) {
      return email;
    }

    const paymentAttemptId = event.data.id;
    const recipientEmail: string = email;
    const firstName = payer.first_name;
    const planName = event.data.subscription_items[0]?.plan?.name;

    const result = await idempotency.run(
      {
        scope: IDEMPOTENCY_PREFIXES.paymentFailed,
        key: paymentAttemptId,
      },
      () =>
        sendEmail({
          idempotencyKey: `${IDEMPOTENCY_PREFIXES.paymentFailed}/${paymentAttemptId}`,
          to: recipientEmail,
          content: createPaymentFailedEmail({ firstName, planName }),
        }),
    );
    if (result.status === "error") {
      console.error(
        "Unable to send payment-failed billing notification",
        result.error,
      );
      return new Response("Billing notification delivery failed", {
        status: 500,
      });
    }
    return result;
  }

  if (event.type === "subscriptionItem.canceled") {
    const payer = event.data.payer;
    if (!payer?.user_id) {
      return ignoredEventResponse();
    }

    const email = getPayerEmail(
      payer.email,
      event.data.id,
      "subscription-canceled",
    );
    if (email instanceof Response) {
      return email;
    }

    const subscriptionItemId = event.data.id;
    const recipientEmail: string = email;
    const firstName = payer.first_name;
    const planName = event.data.plan?.name;

    const result = await idempotency.run(
      {
        scope: IDEMPOTENCY_PREFIXES.subscriptionCanceled,
        key: subscriptionItemId,
      },
      () =>
        sendEmail({
          idempotencyKey: `${IDEMPOTENCY_PREFIXES.subscriptionCanceled}/${subscriptionItemId}`,
          to: recipientEmail,
          content: createSubscriptionCanceledEmail({ firstName, planName }),
        }),
    );
    if (result.status === "error") {
      console.error(
        "Unable to send subscription-canceled billing notification",
        result.error,
      );
      return new Response("Billing notification delivery failed", {
        status: 500,
      });
    }
    return result;
  }

  return ignoredEventResponse();
}

function getPayerEmail(
  payerEmail: string | undefined,
  eventId: string,
  eventName: string,
): string | Response {
  const email = payerEmail?.trim();
  if (!email) {
    console.error("Billing webhook payer email is missing", {
      eventId,
      eventName,
    });
    return new Response("Billing notification recipient email is missing", {
      status: 500,
    });
  }

  return email;
}

function ignoredEventResponse(): Response {
  return Response.json({ received: true, ignored: true });
}

function createWebhookResponse(
  result: BillingNotificationResult | Response,
): Response {
  if (result instanceof Response) {
    return result;
  }

  if (result.status === "in-progress") {
    return Response.json(
      { error: "The billing notification is already being processed." },
      {
        status: 503,
        headers: { "Retry-After": String(result.retryAfterSeconds) },
      },
    );
  }

  return Response.json({
    received: true,
    duplicate: result.status === "duplicate",
  });
}
