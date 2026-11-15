import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CheckoutButton } from "@/components/subscribe/checkout-button";
import { SubscribeLayout } from "@/components/subscribe/subscribe-layout";
import { getSubscribeRedirect } from "@/components/subscribe/flow-state";
import { getCurrentUser } from "@/lib/server-access";
import { formatStripeAmount } from "@/lib/stripe/helper/stripe-checkout-policy";
import { getMonthlyMembershipDetails } from "@/lib/stripe/stripe-catalog";

export default function SubscribePaymentPage() {
  return (
    <Suspense
      fallback={<main className="loading-page">Checking your account...</main>}
    >
      <SubscribePaymentContent />
    </Suspense>
  );
}

async function SubscribePaymentContent() {
  const [currentUser, plan] = await Promise.all([
    getCurrentUser(),
    getMonthlyMembershipDetails(),
  ]);
  const formattedAmount = formatStripeAmount(plan.unitAmount, plan.currency);
  const redirectTo = getSubscribeRedirect("payment", !!currentUser);

  if (redirectTo) {
    redirect(redirectTo);
  }

  return (
    <SubscribeLayout step="payment">
      <div className="activity-heading">
        <h1>Complete your membership.</h1>
        <p>
          Your subscription will be linked to the account you used to sign in.
          Stripe will collect and process your payment securely.{" "}
          {formattedAmount
            ? `The membership is ${formattedAmount} per ${plan.interval}.`
            : ""}
        </p>
      </div>
      <div className="billing-option">
        <div className="billing-option-heading">
          <h2>{plan.productName}</h2>
        </div>
        <CheckoutButton />
      </div>
    </SubscribeLayout>
  );
}
