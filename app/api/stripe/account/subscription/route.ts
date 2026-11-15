import { z } from "zod";
import { env } from "@/env";
import { getCurrentUser } from "@/lib/server-access";
import { getStripeCustomerIdsForUser } from "@/lib/stripe-customers";
import {
  canManageStripeSubscription,
  getLatestPeriodEnd,
  getStripeResourceId,
  isCancellationScheduled,
  isStripeCustomerMappedToUser,
  isSubscriptionOwnedByCustomer,
} from "@/lib/stripe-account-policy";
import { stripe } from "@/lib/stripe";

const requestSchema = z.object({
  customerId: z.string().trim().min(1).max(255),
  subscriptionId: z.string().trim().min(1).max(255),
  action: z.enum(["cancel", "keep"]),
});

export async function POST(request: Request): Promise<Response> {
  if (!isAllowedOrigin(request.headers.get("origin"))) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  let currentUser;
  try {
    currentUser = await getCurrentUser();
  } catch (error) {
    console.error("Could not verify the current user for a Stripe subscription update", error);
    return Response.json(
      { error: "Subscription details are temporarily unavailable." },
      { status: 503 },
    );
  }

  if (!currentUser) {
    return Response.json(
      { error: "Sign in before changing a subscription." },
      { status: 401 },
    );
  }

  const body = await readRequestBody(request);
  if (!body.success) {
    return Response.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) {
    return Response.json(
      { error: "Provide a valid Stripe customer, subscription, and action." },
      { status: 400 },
    );
  }

  try {
    const customerIds = await getStripeCustomerIdsForUser(currentUser.id);
    if (!isStripeCustomerMappedToUser(customerIds, parsed.data.customerId)) {
      return Response.json(
        { error: "That Stripe customer is not linked to your account." },
        { status: 403 },
      );
    }

    const subscription = await stripe.subscriptions.retrieve(
      parsed.data.subscriptionId,
    );
    const subscriptionCustomerId = getStripeResourceId(subscription.customer);
    if (
      !isSubscriptionOwnedByCustomer(
        subscriptionCustomerId,
        parsed.data.customerId,
      )
    ) {
      return Response.json(
        { error: "That subscription does not belong to this Stripe customer." },
        { status: 403 },
      );
    }

    if (!canManageStripeSubscription(subscription.status)) {
      return Response.json(
        { error: "This subscription can no longer be changed." },
        { status: 409 },
      );
    }

    const cancellationScheduled = isCancellationScheduled(
      subscription.status,
      subscription.cancel_at_period_end,
      subscription.cancel_at,
    );
    if (parsed.data.action === "keep" && !cancellationScheduled) {
      return Response.json(
        { error: "This subscription does not have a scheduled cancellation." },
        { status: 409 },
      );
    }

    const updatedSubscription = await stripe.subscriptions.update(
      subscription.id,
      parsed.data.action === "cancel"
        ? { cancel_at_period_end: true }
        : {
            cancel_at_period_end: false,
            ...(subscription.cancel_at === null ? {} : { cancel_at: "" }),
          },
    );

    return Response.json({
      updated: true,
      cancellationScheduled: isCancellationScheduled(
        updatedSubscription.status,
        updatedSubscription.cancel_at_period_end,
        updatedSubscription.cancel_at,
      ),
      cancelAt: updatedSubscription.cancel_at,
      currentPeriodEnd: getLatestPeriodEnd(
        updatedSubscription.items.data.map((item) => item.current_period_end),
      ),
    });
  } catch (error) {
    console.error("Stripe subscription update failed", error);
    return Response.json(
      { error: "Subscription could not be updated. Please try again." },
      { status: 502 },
    );
  }
}

async function readRequestBody(
  request: Request,
): Promise<{ success: true; value: unknown } | { success: false }> {
  try {
    return { success: true, value: await request.json() };
  } catch {
    return { success: false };
  }
}

function isAllowedOrigin(origin: string | null): boolean {
  if (origin === null) {
    return true;
  }

  try {
    return new URL(origin).origin === new URL(env.BETTER_AUTH_URL).origin;
  } catch {
    return false;
  }
}
