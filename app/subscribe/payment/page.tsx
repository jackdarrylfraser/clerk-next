import { Suspense } from "react";
import { redirect } from "next/navigation";
import { env } from "@/env";
import { getSubscribeRedirect } from "@/components/subscribe/flow-state";
import { getCurrentUser } from "@/lib/server-access";

export default function SubscribePaymentPage() {
  return (
    <Suspense
      fallback={<main className="loading-page">Preparing checkout...</main>}
    >
      <SubscribePaymentRedirect />
    </Suspense>
  );
}

async function SubscribePaymentRedirect(): Promise<never> {
  const currentUser = await getCurrentUser();
  const redirectTo = getSubscribeRedirect("payment", !!currentUser);

  if (redirectTo) {
    redirect(redirectTo);
  }

  redirect(env.NEXT_PUBLIC_STRIPE_MONTHLY_PAYMENT_LINK_URL);
}
