import Link from "next/link";
import { Suspense } from "react";
import { SubscribeLayout } from "@/components/subscribe/subscribe-layout";

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
      <article className="plan-card">
        <div className="plan-top">
          <div>
            <h3>Monthly membership</h3>
            <p>
              Continue to create an account. Stripe will show the current price
              before you confirm payment.
            </p>
          </div>
        </div>
        <div className="billing-option">
          <div className="billing-option-heading">
            <h4>Monthly</h4>
          </div>
          <Link className="primary-button" href="/subscribe/account">
            Create account to continue <span>↗</span>
          </Link>
        </div>
      </article>
    </SubscribeLayout>
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
