import Link from "next/link";

export function SubscriptionTerms() {
  return (
    <>
      <p>
        <strong>Plan and billing.</strong> The plan, billing period, and price
        shown above apply to your subscription. Any free trial is subject to
        eligibility and the duration shown above.
      </p>
      <p>
        <strong>Renewal.</strong> Unless you cancel, your subscription
        automatically renews at the displayed rate for the selected billing
        period. If you have an eligible free trial, billing begins after the
        trial ends at the rate shown for your plan.
      </p>
      <p>
        <strong>Payment and account management.</strong> Payments are securely
        handled by Clerk and Stripe. You can manage your subscription in your{" "}
        <Link href="/account">account</Link>.
      </p>
    </>
  );
}
