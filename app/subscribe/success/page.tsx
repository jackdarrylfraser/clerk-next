import Link from "next/link";
import { Suspense } from "react";
import type Stripe from "stripe";
import {
  formatStripeAmount,
  getStripeCheckoutPaymentState,
} from "@/lib/stripe-checkout-policy";
import { stripe } from "@/lib/stripe";

type CheckoutSuccessPageProps = {
  searchParams: Promise<{ session_id?: string | string[] }>;
};

function isMissingCheckoutSession(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  return (
    "type" in error &&
    error.type === "StripeInvalidRequestError" &&
    "code" in error &&
    error.code === "resource_missing"
  );
}

function CheckoutReturnMessage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="activity-home checkout-return">
      <div className="activity-heading">
        <p className="eyebrow">MONTHLY MEMBERSHIP</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </main>
  );
}

export default async function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  return (
    <Suspense
      fallback={
        <CheckoutReturnMessage
          title="Loading checkout details"
          description="Retrieving your purchase information from Stripe."
        />
      }
    >
      <CheckoutSuccessContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CheckoutSuccessContent({
  searchParams,
}: CheckoutSuccessPageProps) {
  const { session_id: sessionIdParam } = await searchParams;
  const sessionId =
    typeof sessionIdParam === "string" ? sessionIdParam.trim() : "";

  if (
    !sessionId.startsWith("cs_") ||
    sessionId.length > 255 ||
    !/^[A-Za-z0-9_]+$/.test(sessionId)
  ) {
    return (
      <CheckoutReturnMessage
        title="Checkout session not found"
        description="This page needs a valid Stripe checkout session to confirm your purchase."
      >
        <Link className="text-button" href="/">
          Return home
        </Link>
      </CheckoutReturnMessage>
    );
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"],
    });
  } catch (error) {
    if (isMissingCheckoutSession(error)) {
      return (
        <CheckoutReturnMessage
          title="Checkout session not found"
          description="We couldn’t find this checkout session. Check the link or return home."
        >
          <Link className="text-button" href="/">
            Return home
          </Link>
        </CheckoutReturnMessage>
      );
    }

    console.error("Stripe Checkout Session retrieval failed", error);
    return (
      <CheckoutReturnMessage
        title="We couldn’t verify your checkout"
        description="Payment details are temporarily unavailable. Refresh this page to try again."
      >
        <Link className="text-button" href="/">
          Return home
        </Link>
      </CheckoutReturnMessage>
    );
  }

  const paymentState = getStripeCheckoutPaymentState({
    status: session.status,
    paymentStatus: session.payment_status,
  });
  const title =
    paymentState === "complete"
      ? "Payment confirmed"
      : paymentState === "processing"
        ? "Payment processing"
        : session.status === "expired"
          ? "Checkout session expired"
          : "Payment not complete";
  const description =
    paymentState === "complete"
      ? "Your monthly membership payment was received."
      : paymentState === "processing"
        ? "Stripe has not confirmed the payment yet. Access is provisioned only after a successful card payment."
        : "Stripe has not confirmed a completed payment for this checkout session.";
  const lineItems = session.line_items?.data ?? [];
  const total = formatStripeAmount(session.amount_total, session.currency);

  return (
    <main className="activity-home checkout-return">
      <div className="activity-heading">
        <p className="eyebrow">MONTHLY MEMBERSHIP</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <section className="checkout-summary" aria-labelledby="checkout-summary-title">
        <h2 id="checkout-summary-title">Purchase details</h2>
        {lineItems.length > 0 ? (
          <ul className="checkout-line-items">
            {lineItems.map((item) => (
              <li key={item.id}>
                <span>
                  {item.description ?? "Monthly membership"}
                  {item.quantity !== null && item.quantity > 1
                    ? ` × ${item.quantity}`
                    : ""}
                </span>
                <strong>
                  {formatStripeAmount(item.amount_total, item.currency) ??
                    "Amount unavailable"}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p>Monthly membership</p>
        )}
        {total !== null && (
          <p className="checkout-total">
            <span>Total</span>
            <strong>{total}</strong>
          </p>
        )}
      </section>

      {paymentState === "complete" ? (
        <p className="checkout-confirmation-note" role="status">
          Your monthly membership payment is confirmed. Account access may take
          a little time to become available for the account you used to start
          checkout.
        </p>
      ) : paymentState === "incomplete" ? (
        <Link className="text-button" href="/subscribe/payment">
          Return to checkout
        </Link>
      ) : null}
    </main>
  );
}
