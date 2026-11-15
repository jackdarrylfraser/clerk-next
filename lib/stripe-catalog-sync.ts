import type Stripe from "stripe";
import type { BuiltStripeCatalog } from "./stripe-catalog";
import { getManagedPriceIdsToDeactivate } from "./stripe-catalog-policy";

type BuiltStripeCatalogReference = Pick<
  BuiltStripeCatalog,
  "catalogKey" | "productId" | "priceId"
>;

export async function activateBuiltStripeCatalog(
  stripeClient: Pick<Stripe, "prices" | "products">,
  catalog: BuiltStripeCatalogReference,
): Promise<string[]> {
  const price = await stripeClient.prices.retrieve(catalog.priceId);
  const productId =
    typeof price.product === "string" ? price.product : price.product.id;
  if (
    productId !== catalog.productId ||
    price.metadata.appCatalogKey !== catalog.catalogKey
  ) {
    throw new Error("The generated Stripe Price does not match its catalog");
  }

  if (!price.active) {
    await stripeClient.prices.update(price.id, { active: true });
  }
  await stripeClient.products.update(catalog.productId, {
    default_price: catalog.priceId,
  });

  const activePrices: Stripe.Price[] = [];
  for await (const activePrice of stripeClient.prices.list({
    product: catalog.productId,
    active: true,
    limit: 100,
  })) {
    activePrices.push(activePrice);
  }

  const oldPriceIds = getManagedPriceIdsToDeactivate(
    activePrices,
    catalog.priceId,
    catalog.catalogKey,
  );
  for (const oldPriceId of oldPriceIds) {
    await stripeClient.prices.update(oldPriceId, { active: false });
  }

  return oldPriceIds;
}
