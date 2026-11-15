import { env } from "@/env";
import { getCurrentUser } from "@/lib/server-access";
import { getStripeCustomerIdForUser } from "@/lib/stripe-customers";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request): Promise<Response> {
  if (!isAllowedOrigin(request.headers.get("origin"))) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  let currentUser;
  try {
    currentUser = await getCurrentUser();
  } catch (error) {
    console.error("Could not verify the current user for Stripe checkout", error);
    return Response.json(
      { error: "Checkout is temporarily unavailable." },
      { status: 503 },
    );
  }

  if (!currentUser) {
    return Response.json(
      { error: "Sign in before starting checkout." },
      { status: 401 },
    );
  }

  if (!env.STRIPE_MONTHLY_PRICE_ID) {
    console.error("Stripe monthly price ID is not configured");
    return Response.json(
      { error: "Checkout is not configured yet." },
      { status: 503 },
    );
  }

  try {
    const customerId = await getStripeCustomerIdForUser(currentUser.id);
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      allowed_payment_method_types: ["card"],
      line_items: [{ price: env.STRIPE_MONTHLY_PRICE_ID, quantity: 1 }],
      client_reference_id: currentUser.id,
      metadata: { appUserId: currentUser.id },
      subscription_data: { metadata: { appUserId: currentUser.id } },
      success_url: `${new URL("/subscribe/success", env.BETTER_AUTH_URL).toString()}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: new URL("/subscribe/payment", env.BETTER_AUTH_URL).toString(),
      ...(customerId ? { customer: customerId } : {}),
    });

    if (!checkoutSession.url) {
      console.error("Stripe Checkout Session did not include a redirect URL");
      return Response.json(
        { error: "Checkout could not be started. Please try again." },
        { status: 502 },
      );
    }

    return Response.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Stripe Checkout Session creation failed", error);
    return Response.json(
      { error: "Checkout could not be started. Please try again." },
      { status: 502 },
    );
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
