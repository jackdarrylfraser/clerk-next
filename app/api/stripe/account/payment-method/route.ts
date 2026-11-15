import { z } from "zod";
import { env } from "@/env";
import {
  createSubscriptionRequiredRedirect,
  getPaidSubscriptionStatus,
} from "@/lib/server-access";
import type { PaidSubscriptionStatus } from "@/lib/server-access";
import { getStripeCustomerIdsForUser } from "@/lib/stripe-customers";
import {
  isStripeCustomerMappedToUser,
} from "@/lib/stripe-account-policy";
import { stripe } from "@/lib/stripe";

const requestSchema = z.object({
  customerId: z.string().trim().min(1).max(255),
});

export async function POST(request: Request): Promise<Response> {
  if (!isAllowedOrigin(request.headers.get("origin"))) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  let access: PaidSubscriptionStatus;
  try {
    access = await getPaidSubscriptionStatus();
  } catch (error) {
    console.error(
      "Could not verify the current user and subscription for a Stripe portal session",
      error,
    );
    return Response.json(
      { error: "Payment method updates are temporarily unavailable." },
      { status: 503 },
    );
  }

  if (access.status === "unauthenticated") {
    return Response.json(
      { error: "Sign in before updating a payment method." },
      { status: 401 },
    );
  }
  if (access.status === "inactive") {
    return createSubscriptionRequiredRedirect();
  }
  const currentUser = access.user;

  const body = await readRequestBody(request);
  if (!body.success) {
    return Response.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) {
    return Response.json(
      { error: "Provide a valid Stripe customer." },
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

    if (!env.STRIPE_PAYMENT_METHOD_PORTAL_CONFIGURATION_ID) {
      console.error("Stripe payment-method portal configuration ID is not configured");
      return Response.json(
        { error: "Payment method updates are not configured yet." },
        { status: 503 },
      );
    }

    const customer = await stripe.customers.retrieve(parsed.data.customerId);
    if ("deleted" in customer && customer.deleted) {
      return Response.json(
        { error: "This Stripe customer is no longer available." },
        { status: 404 },
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: parsed.data.customerId,
      configuration: env.STRIPE_PAYMENT_METHOD_PORTAL_CONFIGURATION_ID,
      return_url: new URL("/account", env.BETTER_AUTH_URL).toString(),
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Stripe payment-method portal session creation failed", error);
    return Response.json(
      { error: "Payment method updates could not be started. Please try again." },
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
