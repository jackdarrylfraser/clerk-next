import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { IdempotencyRunResult } from "@clerk-next/kv";
import {
  createPaymentFailedEmail,
  createSubscriptionCanceledEmail,
  createSubscriptionCreatedEmail,
} from "@/emails/billing-notification-content";
import type { BillingNotificationContent } from "@/emails/billing-notification-content";
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
type BillingNotification = {
  eventId: string;
  scope:
    | typeof IDEMPOTENCY_PREFIXES.subscriptionCreated
    | typeof IDEMPOTENCY_PREFIXES.paymentFailed
    | typeof IDEMPOTENCY_PREFIXES.subscriptionCanceled;
  recipientEmail: string;
  content: BillingNotificationContent;
  failureMessage: string;
};

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
  const notification = getBillingNotification(event);
  if (notification instanceof Response) {
    return notification;
  }

  return sendBillingNotification(notification);
}

function getBillingNotification(
  event: ClerkWebhookEvent,
): BillingNotification | Response {
  if (event.type === EMAIL_EVENTS.subscriptionCreated) {
    return getSubscriptionCreatedNotification(event);
  }

  if (
    event.type === "paymentAttempt.created" ||
    event.type === "paymentAttempt.updated"
  ) {
    return getPaymentFailedNotification(event);
  }

  if (event.type === "subscriptionItem.canceled") {
    return getSubscriptionCanceledNotification(event);
  }

  return ignoredEventResponse();
}

function getSubscriptionCreatedNotification(
  event: ClerkWebhookEvent,
): BillingNotification | Response {
  if (event.type !== EMAIL_EVENTS.subscriptionCreated) {
    return ignoredEventResponse();
  }

  const payer = event.data.payer;
  if (!payer.user_id) {
    return ignoredEventResponse();
  }

  const recipientEmail = getPayerEmail(
    payer.email,
    event.data.id,
    "subscription-created",
  );
  if (recipientEmail instanceof Response) {
    return recipientEmail;
  }

  return {
    eventId: event.data.id,
    scope: IDEMPOTENCY_PREFIXES.subscriptionCreated,
    recipientEmail,
    content: createSubscriptionCreatedEmail({
      firstName: payer.first_name,
      planName: event.data.items[0]?.plan?.name,
    }),
    failureMessage: "Unable to send subscription-created billing notification",
  };
}

function getPaymentFailedNotification(
  event: ClerkWebhookEvent,
): BillingNotification | Response {
  if (
    event.type !== "paymentAttempt.created" &&
    event.type !== "paymentAttempt.updated"
  ) {
    return ignoredEventResponse();
  }

  const payer = event.data.payer;
  if (event.data.status !== "failed" || !payer?.user_id) {
    return ignoredEventResponse();
  }

  const recipientEmail = getPayerEmail(
    payer.email,
    event.data.id,
    "payment-failed",
  );
  if (recipientEmail instanceof Response) {
    return recipientEmail;
  }

  return {
    eventId: event.data.id,
    scope: IDEMPOTENCY_PREFIXES.paymentFailed,
    recipientEmail,
    content: createPaymentFailedEmail({
      firstName: payer.first_name,
      planName: event.data.subscription_items[0]?.plan?.name,
    }),
    failureMessage: "Unable to send payment-failed billing notification",
  };
}

function getSubscriptionCanceledNotification(
  event: ClerkWebhookEvent,
): BillingNotification | Response {
  if (event.type !== "subscriptionItem.canceled") {
    return ignoredEventResponse();
  }

  const payer = event.data.payer;
  if (!payer?.user_id) {
    return ignoredEventResponse();
  }

  const recipientEmail = getPayerEmail(
    payer.email,
    event.data.id,
    "subscription-canceled",
  );
  if (recipientEmail instanceof Response) {
    return recipientEmail;
  }

  return {
    eventId: event.data.id,
    scope: IDEMPOTENCY_PREFIXES.subscriptionCanceled,
    recipientEmail,
    content: createSubscriptionCanceledEmail({
      firstName: payer.first_name,
      planName: event.data.plan?.name,
    }),
    failureMessage: "Unable to send subscription-canceled billing notification",
  };
}

async function sendBillingNotification(
  notification: BillingNotification,
): Promise<BillingNotificationResult | Response> {
  const result = await idempotency.run(
    {
      scope: notification.scope,
      key: notification.eventId,
    },
    () =>
      sendEmail({
        idempotencyKey: `${notification.scope}/${notification.eventId}`,
        to: notification.recipientEmail,
        content: notification.content,
      }),
  );

  if (result.status === "error") {
    console.error(notification.failureMessage, result.error);
    return new Response("Billing notification delivery failed", {
      status: 500,
    });
  }

  return result;
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
