import { z } from "zod";
import { env } from "@/env";
import {
  createSubscriptionRequiredRedirect,
  getPaidSubscriptionStatus,
} from "@/lib/server-access";
import type { PaidSubscriptionStatus } from "@/lib/server-access";
import { isStripeCustomerOwnedByUser } from "@/lib/stripe/stripe-customers";
import { stripe } from "@/lib/stripe/stripe";
import {
  isStripeRequestOriginAllowed,
  readStripeRequestBody,
} from "@/lib/stripe/stripe-request";

const requestSchema = z.object({
  customerId: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(320),
});

export async function POST(request: Request): Promise<Response> {
  if (
    !isStripeRequestOriginAllowed(
      request.headers.get("origin"),
      env.BETTER_AUTH_URL,
    )
  ) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  let access: PaidSubscriptionStatus;
  try {
    access = await getPaidSubscriptionStatus();
  } catch (error) {
    console.error(
      "Could not verify the current user and subscription for a Stripe billing email update",
      error,
    );
    return Response.json(
      { error: "Billing details are temporarily unavailable." },
      { status: 503 },
    );
  }

  if (access.status === "unauthenticated") {
    return Response.json(
      { error: "Sign in before updating billing details." },
      { status: 401 },
    );
  }
  if (access.status === "inactive") {
    return createSubscriptionRequiredRedirect();
  }
  const currentUser = access.user;

  const body = await readStripeRequestBody(request);
  if (!body.success) {
    return Response.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) {
    return Response.json(
      { error: "Provide a valid billing email and Stripe customer." },
      { status: 400 },
    );
  }

  try {
    if (
      !(await isStripeCustomerOwnedByUser(
        currentUser.id,
        parsed.data.customerId,
      ))
    ) {
      return Response.json(
        { error: "That Stripe customer is not linked to your account." },
        { status: 403 },
      );
    }

    const customer = await stripe.customers.retrieve(parsed.data.customerId);
    if ("deleted" in customer && customer.deleted) {
      return Response.json(
        { error: "This Stripe customer is no longer available." },
        { status: 404 },
      );
    }

    await stripe.customers.update(parsed.data.customerId, {
      email: parsed.data.email,
    });

    return Response.json({ updated: true });
  } catch (error) {
    console.error("Stripe billing email update failed", error);
    return Response.json(
      { error: "Billing email could not be updated. Please try again." },
      { status: 502 },
    );
  }
}
