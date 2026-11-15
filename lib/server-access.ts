import "server-only";
import { io } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/better-auth";
import { hasStripeAccess } from "@/lib/stripe-access";
import { env } from "@/env";

type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export type CurrentUser = AuthSession["user"];

export type PaidSubscriptionStatus =
  | { status: "unauthenticated" }
  | { status: "inactive"; user: CurrentUser }
  | { status: "active"; user: CurrentUser };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  await io();
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function getPaidSubscriptionStatus(): Promise<PaidSubscriptionStatus> {
  const current = await getCurrentUser();
  if (!current) {
    return { status: "unauthenticated" };
  }

  return (await hasStripeAccess(current.id))
    ? { status: "active", user: current }
    : { status: "inactive", user: current };
}

export async function requirePaidSubscription(
  returnTo: string,
): Promise<CurrentUser> {
  const access = await getPaidSubscriptionStatus();
  if (access.status === "unauthenticated") {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
  }

  if (access.status === "inactive") {
    redirect("/subscribe/plan?required=true");
  }

  return access.user;
}

export function createSubscriptionRequiredRedirect(): Response {
  return Response.redirect(
    new URL("/subscribe/plan?required=true", env.BETTER_AUTH_URL),
    303,
  );
}
