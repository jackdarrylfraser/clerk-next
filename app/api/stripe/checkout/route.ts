import { env } from "@/env";
import { getCurrentUser } from "@/lib/server-access";
import { getStripeCustomerIdForUser } from "@/lib/stripe/stripe-customers";
import { stripe } from "@/lib/stripe/stripe";
import { readBuiltStripeCatalog } from "@/lib/stripe/stripe-catalog";
import { activateBuiltStripeCatalog } from "@/lib/stripe/stripe-catalog-sync";
import { isStripeRequestOriginAllowed } from "@/lib/stripe/stripe-request";

export async function POST(request: Request): Promise<Response> {
  if (
    !isStripeRequestOriginAllowed(
      request.headers.get("origin"),
      env.BETTER_AUTH_URL,
    )
  ) {
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

  let catalog: Awaited<ReturnType<typeof readBuiltStripeCatalog>>;
  try {
    catalog = await readBuiltStripeCatalog();
  } catch (error) {
    console.error("Could not load the generated Stripe catalog", error);
    return Response.json(
      { error: "Checkout is not configured yet." },
      { status: 503 },
    );
  }

  if (!catalog) {
    console.error("The generated Stripe catalog is missing");
    return Response.json(
      { error: "Checkout is not configured yet." },
      { status: 503 },
    );
  }

  const priceId = catalog.priceId;

  try {
    await activateBuiltStripeCatalog(stripe, catalog);

    const customerId = await getStripeCustomerIdForUser(currentUser.id);
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      allowed_payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
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
