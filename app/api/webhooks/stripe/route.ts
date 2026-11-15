import { eq } from "drizzle-orm";
import { env } from "@/env";
import { sendEmail } from "@/emails/send-email";
import { user as appUser } from "@/db/schema";
import { getDb } from "@/lib/drizzle";
import { idempotency } from "@/lib/kv";
import { invalidateStripeAccessCache } from "@/lib/stripe/stripe-access";
import {
  associateStripeCustomerWithUser,
  getStripeCustomerOwner,
} from "@/lib/stripe/stripe-customers";
import { processStripeWebhookEvent } from "@/lib/stripe/stripe-webhook";
import { verifyStripeWebhookEvent } from "@/lib/stripe/stripe-webhook-signature";
import { stripe } from "@/lib/stripe/stripe";

export async function POST(request: Request): Promise<Response> {
  let event;
  try {
    const rawBody = await request.text();
    event = await verifyStripeWebhookEvent(
      stripe,
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
    const result = await processStripeWebhookEvent(event, {
      idempotency,
      async findUser(userId) {
        const [record] = await getDb()
          .select({ id: appUser.id })
          .from(appUser)
          .where(eq(appUser.id, userId))
          .limit(1);

        return record ?? null;
      },
      associateCustomer: associateStripeCustomerWithUser,
      invalidateAccess: invalidateStripeAccessCache,
      findUserForCustomer: getStripeCustomerOwner,
      async sendLifecycleNotification(account, event, content) {
        await sendEmail({
          idempotencyKey: `stripe/${event.type}/${event.id}`,
          to: account.email,
          content,
        });
      },
    });

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
