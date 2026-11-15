import Link from "next/link";
import { Suspense } from "react";
import { SubscribeLayout } from "@/components/subscribe/subscribe-layout";
import { formatStripeAmount } from "@/lib/stripe/helper/stripe-checkout-policy";
import { getMonthlyMembershipDetails } from "@/lib/stripe/build/stripe-catalog";

export default function SubscribePlanPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string | string[] }>;
}) {
  return (
    <SubscribeLayout step="plan">
      <Suspense fallback={null}>
        <SubscriptionRequiredNotice searchParams={searchParams} />
      </Suspense>
      <Suspense
        fallback={<p className="loading-page">Loading membership plan...</p>}
      >
        <MembershipPlan />
      </Suspense>
    </SubscribeLayout>
  );
}

async function MembershipPlan() {
  const plan = await getMonthlyMembershipDetails();
  const formattedAmount = formatStripeAmount(plan.unitAmount, plan.currency);

  return (
    <article className="plan-card">
      <div className="plan-top">
        <div>
          <h3>{plan.productName}</h3>
          <p>
            {plan.productDescription}. The subscription renews every{" "}
            {plan.intervalCount > 1 ? `${plan.intervalCount} ` : ""}
            {plan.interval}
            {plan.intervalCount > 1 ? "s" : ""}.
          </p>
        </div>
      </div>
      <div className="billing-option">
        <div className="billing-option-heading">
          <h4>
            {formattedAmount
              ? `${formattedAmount} / ${plan.interval}`
              : plan.interval}
          </h4>
        </div>
        <Link className="primary-button" href="/subscribe/account">
          Create account to continue <span>↗</span>
        </Link>
      </div>
    </article>
  );
}

async function SubscriptionRequiredNotice({
  searchParams,
}: {
  searchParams: Promise<{ required?: string | string[] }>;
}) {
  const { required } = await searchParams;
  if (required !== "true") {
    return null;
  }

  return (
    <p className="error-message" role="alert">
      An active subscription is required to access your account and paid
      content. Choose a membership below to continue.
    </p>
  );
}
