import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { env } from "@/env";
import type { NextRequest } from "next/server";
import { sendSubscriptionCreatedEvent } from "@/emails/automations/events";

export async function POST(request: NextRequest): Promise<Response> {
  if (!env.CLERK_WEBHOOK_SIGNING_SECRET) {
    console.error("Clerk webhook signing secret is not configured");
    return new Response("Webhook signing secret is not configured", {
      status: 500,
    });
  }

  let event: Awaited<ReturnType<typeof verifyWebhook>>;

  try {
    event = await verifyWebhook(request);
  } catch (error) {
    console.error("Clerk webhook verification failed", error);
    return new Response("Webhook verification failed", { status: 400 });
  }

  if (event.type !== "subscription.created") {
    return Response.json({ received: true, ignored: true });
  }

  const { id, payer } = event.data;
  if (!payer.user_id) {
    return Response.json({ received: true, ignored: true });
  }

  if (!payer.email.trim()) {
    console.error("Subscription-created webhook has no payer email", {
      subscriptionId: id,
    });
    return new Response("Subscription payer email is missing", { status: 500 });
  }

  try {
    const result = await sendSubscriptionCreatedEvent({
      subscriptionId: id,
      email: payer.email,
      firstName: payer.first_name,
      lastName: payer.last_name,
    });

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
  } catch (error) {
    console.error("Unable to trigger subscription automations", error);
    return new Response("Automation event delivery failed", { status: 500 });
  }
}
