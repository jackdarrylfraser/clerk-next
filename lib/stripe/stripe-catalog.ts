import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { monthlyMembershipDefinition } from "./helper/stripe-catalog-definition";

const stripeCatalogSchema = z.object({
  catalogKey: z.literal(monthlyMembershipDefinition.catalogKey),
  productId: z.string().min(1),
  priceId: z.string().min(1),
  productName: z.string().min(1),
  productDescription: z.string(),
  unitAmount: z.number().int().nonnegative(),
  currency: z.string().length(3),
  interval: z.enum(["day", "week", "month", "year"]),
  intervalCount: z.number().int().positive(),
});

export type BuiltStripeCatalog = z.infer<typeof stripeCatalogSchema>;

export async function readBuiltStripeCatalog(): Promise<BuiltStripeCatalog | null> {
  let contents: string;

  try {
    contents = await readFile(
      join(process.cwd(), "public", "stripe-catalog.json"),
      "utf8",
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }

  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch (error) {
    throw new Error("The generated Stripe catalog is not valid JSON", {
      cause: error,
    });
  }

  const parsed = stripeCatalogSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("The generated Stripe catalog has an invalid shape", {
      cause: parsed.error,
    });
  }

  return parsed.data;
}

export async function getMonthlyMembershipDetails(): Promise<{
  productName: string;
  productDescription: string;
  unitAmount: number;
  currency: string;
  interval: "day" | "week" | "month" | "year";
  intervalCount: number;
}> {
  const catalog = await readBuiltStripeCatalog();
  if (catalog) {
    return {
      productName: catalog.productName,
      productDescription: catalog.productDescription,
      unitAmount: catalog.unitAmount,
      currency: catalog.currency,
      interval: catalog.interval,
      intervalCount: catalog.intervalCount,
    };
  }

  return {
    productName: monthlyMembershipDefinition.productName,
    productDescription: monthlyMembershipDefinition.productDescription,
    unitAmount: monthlyMembershipDefinition.unitAmount,
    currency: monthlyMembershipDefinition.currency,
    interval: monthlyMembershipDefinition.interval,
    intervalCount: monthlyMembershipDefinition.intervalCount,
  };
}
