import Link from "next/link";
import { SubscribeLayout } from "@/components/subscribe/subscribe-layout";

export default function SubscribePlanPage() {
  return (
    <SubscribeLayout step="plan">
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
