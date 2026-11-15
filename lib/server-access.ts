import "server-only";
import { io } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/better-auth";
import { hasStripeAccess } from "@/lib/stripe-access";

type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export type CurrentUser = AuthSession["user"];

export async function getCurrentUser(): Promise<CurrentUser | null> {
  await io();
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function requirePaidSubscription(
  returnTo: string,
): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
  }

  if (!(await hasStripeAccess(current.id))) {
    redirect("/subscribe/plan");
  }

  return current;
}
