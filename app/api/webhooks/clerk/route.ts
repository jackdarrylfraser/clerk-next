import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type {
  IdempotencyKey,
  IdempotencyRunResult,
} from "@clerk-next/kv";
import { env } from "@/env";
import type { NextRequest } from "next/server";
import { IDEMPOTENCY_SCOPES, idempotency } from "@/lib/kv";
import {
  sendPaymentFailedEmail,
  sendSubscriptionCanceledEmail,
  sendSubscriptionCreatedEmail,
} from "@/emails/billing-notifications";

type ClerkWebhookEvent = Awaited<ReturnType<typeof verifyWebhook>>;
type BillingNotificationResult = IdempotencyRunResult<void>;

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
  if (event.type === "subscription.created") {
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

    async function sendSubscriptionCreatedNotification(): Promise<void> {
      await sendSubscriptionCreatedEmail({
        subscriptionId,
        email: recipientEmail,
        firstName,
        planName,
      });
    }

    return sendNotification(
      "subscription-created",
      {
        scope: IDEMPOTENCY_SCOPES.billingSubscriptionCreated,
        key: `subscription-created/${subscriptionId}`,
      },
      sendSubscriptionCreatedNotification,
    );
  }

  if (
    event.type === "paymentAttempt.created" ||
    event.type === "paymentAttempt.updated"
  ) {
    const payer = event.data.payer;
    if (event.data.status !== "failed" || !payer?.user_id) {
      return ignoredEventResponse();
    }

    const email = getPayerEmail(
      payer.email,
      event.data.id,
      "payment-failed",
    );
    if (email instanceof Response) {
      return email;
    }

    const paymentAttemptId = event.data.id;
    const recipientEmail: string = email;
    const firstName = payer.first_name;
    const planName = event.data.subscription_items[0]?.plan?.name;

    async function sendPaymentFailedNotification(): Promise<void> {
      await sendPaymentFailedEmail({
        paymentAttemptId,
        email: recipientEmail,
        firstName,
        planName,
      });
    }

    return sendNotification(
      "payment-failed",
      {
        scope: IDEMPOTENCY_SCOPES.billingPaymentFailed,
        key: `payment-failed/${paymentAttemptId}`,
      },
      sendPaymentFailedNotification,
    );
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

    async function sendSubscriptionCanceledNotification(): Promise<void> {
      await sendSubscriptionCanceledEmail({
        subscriptionItemId,
        email: recipientEmail,
        firstName,
        planName,
      });
    }

    return sendNotification(
      "subscription-canceled",
      {
        scope: IDEMPOTENCY_SCOPES.billingSubscriptionCanceled,
        key: `subscription-canceled/${subscriptionItemId}`,
      },
      sendSubscriptionCanceledNotification,
    );
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

async function sendNotification(
  eventName: string,
  idempotencyKey: IdempotencyKey,
  send: () => Promise<void>,
): Promise<BillingNotificationResult | Response> {
  try {
    return await idempotency.run(idempotencyKey, send);
  } catch (error) {
    console.error(`Unable to send ${eventName} billing notification`, error);
    return new Response("Billing notification delivery failed", {
      status: 500,
    });
  }
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
