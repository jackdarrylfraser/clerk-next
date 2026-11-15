import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CheckoutAccountForm } from "@/components/subscribe/checkout-account-form";
import { SubscribeLayout } from "@/components/subscribe/subscribe-layout";
import { getSubscribeRedirect } from "@/components/subscribe/flow-state";
import { getCurrentUser } from "@/lib/server-access";

export default function SubscribeAccountPage() {
  return (
    <Suspense
      fallback={<main className="loading-page">Checking your account...</main>}
    >
      <SubscribeAccountContent />
    </Suspense>
  );
}

async function SubscribeAccountContent() {
  const currentUser = await getCurrentUser();
  const redirectTo = getSubscribeRedirect("account", !!currentUser);

  if (redirectTo) {
    redirect(redirectTo);
  }

  return (
    <SubscribeLayout step="account">
      <CheckoutAccountForm />
    </SubscribeLayout>
  );
}
