import { z } from "zod";
import { env } from "@/env";
import { getCurrentUser } from "@/lib/server-access";
import { getStripeCustomerIdsForUser } from "@/lib/stripe-customers";
import { isStripeCustomerMappedToUser } from "@/lib/stripe-account-policy";
import { stripe } from "@/lib/stripe";

const requestSchema = z.object({
  customerId: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(320),
});

export async function POST(request: Request): Promise<Response> {
  if (!isAllowedOrigin(request.headers.get("origin"))) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  let currentUser;
  try {
    currentUser = await getCurrentUser();
  } catch (error) {
    console.error("Could not verify the current user for a Stripe billing email update", error);
    return Response.json(
      { error: "Billing details are temporarily unavailable." },
      { status: 503 },
    );
  }

  if (!currentUser) {
    return Response.json(
      { error: "Sign in before updating billing details." },
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
      { error: "Provide a valid billing email and Stripe customer." },
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
