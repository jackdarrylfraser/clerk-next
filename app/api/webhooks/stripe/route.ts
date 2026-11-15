import { env } from "@/env";
import { processStripeWebhookEvent } from "@/lib/stripe/stripe-webhook";
import { verifyStripeWebhookEvent } from "@/lib/stripe/stripe-webhook-signature";

export async function POST(request: Request): Promise<Response> {
  let event;
  try {
    const rawBody = await request.text();
    event = await verifyStripeWebhookEvent(
      rawBody,
      request.headers.get("stripe-signature"),
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return new Response("Webhook signature verification failed", {
      status: 400,
    });
  }

  try {
    const result = await processStripeWebhookEvent(event);

    if (result.status === "in-progress") {
      return Response.json(
        { error: "This checkout is already being processed." },
        {
          status: 503,
          headers: { "Retry-After": String(result.retryAfterSeconds) },
        },
      );
    }

    return Response.json({
      received: true,
      ignored: result.status === "ignored",
      duplicate: result.status === "duplicate",
    });
  } catch (error) {
    console.error("Stripe webhook event processing failed", error);
    return Response.json(
      { error: "Stripe webhook event processing failed." },
      { status: 500 },
    );
  }
}
