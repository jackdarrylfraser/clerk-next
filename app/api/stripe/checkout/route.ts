import type Stripe from "stripe";
import { env } from "@/env";
import { getCurrentUser } from "@/lib/server-access";
import { getStripeCustomerIdForUser } from "@/lib/stripe-customers";
import { stripe } from "@/lib/stripe";
import { readBuiltStripeCatalog } from "@/lib/stripe-catalog";
import { getManagedPriceIdsToDeactivate } from "@/lib/stripe-catalog-policy";

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
    await restoreCatalogPriceIfNeeded(catalog);

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

async function restoreCatalogPriceIfNeeded(
  catalog: NonNullable<Awaited<ReturnType<typeof readBuiltStripeCatalog>>>,
): Promise<void> {
  const price = await stripe.prices.retrieve(catalog.priceId);
  const productId =
    typeof price.product === "string" ? price.product : price.product.id;
  if (
    productId !== catalog.productId ||
    price.metadata.appCatalogKey !== catalog.catalogKey
  ) {
    throw new Error("The generated Stripe Price does not match its catalog");
  }
  if (price.active) {
    return;
  }

  await stripe.prices.update(price.id, { active: true });
  await stripe.products.update(catalog.productId, {
    default_price: catalog.priceId,
  });

  const activePrices: Stripe.Price[] = [];
  for await (const activePrice of stripe.prices.list({
    product: catalog.productId,
    active: true,
    limit: 100,
  })) {
    activePrices.push(activePrice);
  }

  const oldPriceIds = getManagedPriceIdsToDeactivate(
    activePrices,
    catalog.priceId,
  );
  for (const oldPriceId of oldPriceIds) {
    await stripe.prices.update(oldPriceId, { active: false });
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
