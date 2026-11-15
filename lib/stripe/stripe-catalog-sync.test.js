import { describe, expect, it } from "bun:test";
import { activateBuiltStripeCatalog } from "./stripe-catalog-sync.ts";

function createStripeClient({
  active = false,
  productId = "prod_membership",
  catalogKey = "monthly-membership",
} = {}) {
  const updates = [];
  const prices = [
    {
      id: "price_current",
      product: productId,
      active,
      metadata: { appCatalogKey: catalogKey },
    },
    {
      id: "price_old",
      active: true,
      metadata: { appCatalogKey: catalogKey },
    },
    {
      id: "price_unmanaged",
      active: true,
      metadata: {},
    },
  ];

  return {
    updates,
    client: {
      prices: {
        async retrieve() {
          return prices[0];
        },
        async update(priceId, params) {
          updates.push({ resource: "price", id: priceId, params });
        },
        async *list() {
          yield* prices;
        },
      },
      products: {
        async update(productId, params) {
          updates.push({ resource: "product", id: productId, params });
        },
      },
    },
  };
}

const catalog = {
  catalogKey: "monthly-membership",
  productId: "prod_membership",
  priceId: "price_current",
};

describe("Stripe catalog activation", () => {
  it("activates the built Price, sets the default, and deactivates managed old Prices", async () => {
    const { client, updates } = createStripeClient();

    await expect(activateBuiltStripeCatalog(client, catalog)).resolves.toEqual([
      "price_old",
    ]);
    expect(updates).toEqual([
      { resource: "price", id: "price_current", params: { active: true } },
      {
        resource: "product",
        id: "prod_membership",
        params: { default_price: "price_current" },
      },
      { resource: "price", id: "price_old", params: { active: false } },
    ]);
  });

  it("sets the Product default without reactivating an already active Price", async () => {
    const { client, updates } = createStripeClient({ active: true });

    await expect(activateBuiltStripeCatalog(client, catalog)).resolves.toEqual([
      "price_old",
    ]);
    expect(updates).toEqual([
      {
        resource: "product",
        id: "prod_membership",
        params: { default_price: "price_current" },
      },
      { resource: "price", id: "price_old", params: { active: false } },
    ]);
  });

  it("rejects a Price that does not match the built catalog", async () => {
    const { client } = createStripeClient({ catalogKey: "another-catalog" });

    await expect(activateBuiltStripeCatalog(client, catalog)).rejects.toThrow(
      "does not match its catalog",
    );
  });
});
