import "server-only";
import { eq } from "drizzle-orm";
import { stripeCustomer, user } from "@/db/schema";
import { getDb } from "@/lib/drizzle";

export interface StripeCustomerOwner {
  id: string;
  email: string;
  name: string;
}

export async function getStripeCustomerIdsForUser(
  userId: string,
): Promise<string[]> {
  const rows = await getDb()
    .select({ stripeCustomerId: stripeCustomer.stripeCustomerId })
    .from(stripeCustomer)
    .where(eq(stripeCustomer.userId, userId));

  return rows.map((row) => row.stripeCustomerId);
}

export async function isStripeCustomerOwnedByUser(
  userId: string,
  stripeCustomerId: string,
): Promise<boolean> {
  const customerIds = await getStripeCustomerIdsForUser(userId);
  return customerIds.includes(stripeCustomerId);
}

export async function getStripeCustomerIdForUser(
  userId: string,
): Promise<string | null> {
  const customerIds = await getStripeCustomerIdsForUser(userId);
  return customerIds[0] ?? null;
}

export async function getStripeCustomerOwner(
  stripeCustomerId: string,
): Promise<StripeCustomerOwner | null> {
  const [owner] = await getDb()
    .select({ id: user.id, email: user.email, name: user.name })
    .from(stripeCustomer)
    .innerJoin(user, eq(stripeCustomer.userId, user.id))
    .where(eq(stripeCustomer.stripeCustomerId, stripeCustomerId))
    .limit(1);

  return owner ?? null;
}

export async function associateStripeCustomerWithUser(
  stripeCustomerId: string,
  userId: string,
): Promise<void> {
  if (!stripeCustomerId.trim() || !userId.trim()) {
    throw new Error("A Stripe customer ID and user ID are required");
  }

  await getDb()
    .insert(stripeCustomer)
    .values({ stripeCustomerId, userId })
    .onConflictDoNothing();

  const [mapping] = await getDb()
    .select({ userId: stripeCustomer.userId })
    .from(stripeCustomer)
    .where(eq(stripeCustomer.stripeCustomerId, stripeCustomerId))
    .limit(1);

  if (!mapping) {
    throw new Error("Stripe customer mapping could not be saved");
  }
  if (mapping.userId !== userId) {
    throw new Error("Stripe customer is already associated with another user");
  }
}
