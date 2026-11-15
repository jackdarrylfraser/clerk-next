import "server-only";
import { auth as clerkAuth } from "@clerk/nextjs/server";

export const paidContentFeature = "guest-content";

export async function hasPaidContentAccess(): Promise<boolean> {
  const { has } = await clerkAuth();
  return has({ feature: paidContentFeature });
}
