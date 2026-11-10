import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { env } from "@/env";
import type { NextRequest } from "next/server";
import { sendSubscriptionCreatedEmail } from "@/emails/email";

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
    await sendSubscriptionCreatedEmail({
      subscriptionId: id,
      email: payer.email,
      firstName: payer.first_name,
      lastName: payer.last_name,
    });
  } catch (error) {
    console.error("Unable to send subscription-created email", error);
    return new Response("Email delivery failed", { status: 500 });
  }

  return Response.json({ received: true });
}
