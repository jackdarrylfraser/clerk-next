import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { env } from "@/env";
import type { NextRequest } from "next/server";
import { sendSubscriptionCreatedEvent } from "@/emails/automations/events";

type ClerkWebhookEvent = Awaited<ReturnType<typeof verifyWebhook>>;
type SubscriptionAutomationResult = Awaited<
  ReturnType<typeof sendSubscriptionCreatedEvent>
>;

export async function POST(request: NextRequest): Promise<Response> {
  const secretResponse = await checkWebhookSigningSecret();
  const verifiedEvent = await verifyClerkWebhook(request, secretResponse);
  const subscriptionEvent = getSubscriptionCreatedEvent(verifiedEvent);
  const validatedEvent = validateSubscriptionPayer(subscriptionEvent);
  const automationResult =
    await deliverSubscriptionCreatedEvent(validatedEvent);

  return createWebhookResponse(automationResult);
}

async function checkWebhookSigningSecret(): Promise<Response | undefined> {
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

function getSubscriptionCreatedEvent(
  event: ClerkWebhookEvent | Response,
) {
  if (event instanceof Response) {
    return event;
  }

  if (event.type !== "subscription.created") {
    return Response.json({ received: true, ignored: true });
  }

  if (!event.data.payer.user_id) {
    return Response.json({ received: true, ignored: true });
  }

  return event;
}

type SubscriptionCreatedEvent = Exclude<
  ReturnType<typeof getSubscriptionCreatedEvent>,
  Response
>;

function validateSubscriptionPayer(
  event: SubscriptionCreatedEvent | Response,
): SubscriptionCreatedEvent | Response {
  if (event instanceof Response) {
    return event;
  }

  const { id, payer } = event.data;
  if (!payer.email.trim()) {
    console.error("Subscription-created webhook has no payer email", {
      subscriptionId: id,
    });
    return new Response("Subscription payer email is missing", { status: 500 });
  }

  return event;
}

async function deliverSubscriptionCreatedEvent(
  event: SubscriptionCreatedEvent | Response,
): Promise<SubscriptionAutomationResult | Response> {
  if (event instanceof Response) {
    return event;
  }

  const { id, payer } = event.data;
  try {
    return await sendSubscriptionCreatedEvent({
      subscriptionId: id,
      email: payer.email,
      firstName: payer.first_name,
      lastName: payer.last_name,
    });
  } catch (error) {
    console.error("Unable to trigger subscription automations", error);
    return new Response("Automation event delivery failed", { status: 500 });
  }
}

function createWebhookResponse(
  result: SubscriptionAutomationResult | Response,
): Response {
  if (result instanceof Response) {
    return result;
  }

  if (result.status === "in-progress") {
    return Response.json(
      { error: "The subscription automation event is already being processed." },
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
