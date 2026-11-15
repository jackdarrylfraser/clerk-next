import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Stripe from "stripe";
import {
  monthlyMembershipDefinition,
  type StripeCatalogDefinition,
} from "../helper/stripe-catalog-definition";

const metadataKey = "appCatalogKey";

async function findManagedProduct(
  stripe: Stripe,
  definition: StripeCatalogDefinition,
): Promise<Stripe.Product | undefined> {
  const matches: Stripe.Product[] = [];
  for await (const product of stripe.products.list({ limit: 100 })) {
    if (product.metadata[metadataKey] === definition.catalogKey) {
      matches.push(product);
    }
  }

  if (matches.length > 1) {
    throw new Error(
      `More than one Stripe Product is marked with ${metadataKey}=${definition.catalogKey}`,
    );
  }

  return matches[0];
}

function getProductId(price: Stripe.Price): string {
  return typeof price.product === "string" ? price.product : price.product.id;
}

async function getOrCreateProduct(
  stripe: Stripe,
  definition: StripeCatalogDefinition,
): Promise<Stripe.Product> {
  let product = await findManagedProduct(stripe, definition);

  if (!product) {
    product = await stripe.products.create(
      {
        name: definition.productName,
        description: definition.productDescription,
        metadata: { [metadataKey]: definition.catalogKey },
      },
      {
        idempotencyKey: `outbound-catalog-product-${definition.catalogKey}-v1`,
      },
    );
  }

  const metadata = {
    ...product.metadata,
    [metadataKey]: definition.catalogKey,
  };
  if (
    product.name !== definition.productName ||
    product.description !== definition.productDescription ||
    product.metadata[metadataKey] !== definition.catalogKey
  ) {
    product = await stripe.products.update(product.id, {
      name: definition.productName,
      description: definition.productDescription,
      metadata,
    });
  }

  return product;
}

function isDesiredPrice(
  price: Stripe.Price,
  definition: StripeCatalogDefinition,
): boolean {
  return (
    price.currency === definition.currency &&
    price.unit_amount === definition.unitAmount &&
    price.type === "recurring" &&
    price.recurring?.interval === definition.interval &&
    price.recurring.interval_count === definition.intervalCount
  );
}

async function getProductPrices(
  stripe: Stripe,
  productId: string,
): Promise<Stripe.Price[]> {
  const prices: Stripe.Price[] = [];
  for (const active of [true, false]) {
    for await (const price of stripe.prices.list({
      product: productId,
      active,
      limit: 100,
    })) {
      prices.push(price);
    }
  }

  return prices;
}

async function findOrCreatePrice(
  stripe: Stripe,
  product: Stripe.Product,
  definition: StripeCatalogDefinition,
): Promise<Stripe.Price> {
  const lookupMatches: Stripe.Price[] = [];
  for await (const price of stripe.prices.list({
    lookup_keys: [definition.lookupKey],
    limit: 100,
  })) {
    lookupMatches.push(price);
  }

  if (lookupMatches.some((price) => getProductId(price) !== product.id)) {
    throw new Error(
      `Stripe lookup key "${definition.lookupKey}" belongs to another Product`,
    );
  }

  const prices = await getProductPrices(stripe, product.id);
  const managedPrices: Stripe.Price[] = [];
  for (const price of prices) {
    const isManaged =
      price.metadata[metadataKey] === definition.catalogKey ||
      lookupMatches.some((lookupMatch) => lookupMatch.id === price.id);
    if (!isManaged) {
      continue;
    }

    if (price.metadata[metadataKey] !== definition.catalogKey) {
      managedPrices.push(
        await stripe.prices.update(price.id, {
          metadata: {
            ...price.metadata,
            [metadataKey]: definition.catalogKey,
          },
        }),
      );
    } else {
      managedPrices.push(price);
    }
  }

  const keyedPrice = managedPrices.find(
    (price) => price.lookup_key === definition.lookupKey,
  );
  const exactPrices = managedPrices.filter((price) =>
    isDesiredPrice(price, definition),
  );
  let price =
    keyedPrice && isDesiredPrice(keyedPrice, definition)
      ? keyedPrice
      : undefined;

  if (!price && exactPrices.length > 1) {
    const activeMatches = exactPrices.filter((candidate) => candidate.active);
    if (activeMatches.length === 1) {
      price = activeMatches[0];
    } else {
      throw new Error(
        `More than one Stripe Price matches the declared "${definition.catalogKey}" price`,
      );
    }
  } else if (!price) {
    price = exactPrices[0];
  }

  if (price) {
    if (!price.active || price.lookup_key !== definition.lookupKey) {
      return stripe.prices.update(price.id, {
        active: true,
        lookup_key: definition.lookupKey,
        transfer_lookup_key: true,
        metadata: {
          ...price.metadata,
          [metadataKey]: definition.catalogKey,
        },
      });
    }
    return price;
  }

  return stripe.prices.create(
    {
      product: product.id,
      currency: definition.currency,
      unit_amount: definition.unitAmount,
      recurring: {
        interval: definition.interval,
        interval_count: definition.intervalCount,
      },
      lookup_key: definition.lookupKey,
      transfer_lookup_key: true,
      metadata: { [metadataKey]: definition.catalogKey },
    },
    {
      idempotencyKey: `outbound-catalog-price-${definition.catalogKey}-${definition.currency}-${definition.unitAmount}-${definition.interval}-${definition.intervalCount}`,
    },
  );
}

async function writeBuiltCatalog(
  product: Stripe.Product,
  price: Stripe.Price,
  definition: StripeCatalogDefinition,
): Promise<void> {
  const outputDirectory = join(process.cwd(), "public");
  const outputPath = join(outputDirectory, "stripe-catalog.json");
  const temporaryPath = `${outputPath}.tmp`;
  const catalog = {
    catalogKey: definition.catalogKey,
    productId: product.id,
    priceId: price.id,
    productName: definition.productName,
    productDescription: definition.productDescription,
    unitAmount: definition.unitAmount,
    currency: definition.currency,
    interval: definition.interval,
    intervalCount: definition.intervalCount,
  };

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  await rename(temporaryPath, outputPath);
}

async function syncCatalog(
  stripe: Stripe,
  definition: StripeCatalogDefinition,
): Promise<void> {
  const product = await getOrCreateProduct(stripe, definition);
  const price = await findOrCreatePrice(stripe, product, definition);
  if (product.default_price !== price.id) {
    await stripe.products.update(product.id, { default_price: price.id });
  }
  await writeBuiltCatalog(product, price, definition);
  console.info(
    `Synced Stripe catalog: ${product.id} / ${price.id} (${definition.currency.toUpperCase()} ${definition.unitAmount / 100} per ${definition.interval})`,
  );
}

async function runSync(): Promise<void> {
  const apiKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is required to sync the Stripe catalog");
  }

  const stripe = new Stripe(apiKey);
  await syncCatalog(stripe, monthlyMembershipDefinition);
}

try {
  await runSync();
} catch (error) {
  console.error("Stripe catalog sync failed", error);
  process.exitCode = 1;
}
