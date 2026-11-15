import { describe, expect, it, mock } from "bun:test";

let prices = [];
let updates = [];
const stripe = {
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
};

function setStripeState({
  active = false,
  productId = "prod_membership",
  catalogKey = "monthly-membership",
} = {}) {
  updates = [];
  prices = [
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

  return updates;
}

mock.module("@/lib/stripe/stripe", () => ({ stripe }));
const { activateBuiltStripeCatalog } = await import("./stripe-catalog-sync.ts");

const catalog = {
  catalogKey: "monthly-membership",
  productId: "prod_membership",
  priceId: "price_current",
};

describe("Stripe catalog activation", () => {
  it("activates the built Price, sets the default, and deactivates managed old Prices", async () => {
    const updates = setStripeState();

    await expect(activateBuiltStripeCatalog(catalog)).resolves.toEqual([
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
    const updates = setStripeState({ active: true });

    await expect(activateBuiltStripeCatalog(catalog)).resolves.toEqual([
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
    setStripeState({ catalogKey: "another-catalog" });

    await expect(activateBuiltStripeCatalog(catalog)).rejects.toThrow(
      "does not match its catalog",
    );
  });
});
