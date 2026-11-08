"use client";

import { SignIn, SignUp, useAuth } from "@clerk/nextjs";
import {
  CheckoutProvider,
  PaymentElement,
  PaymentElementProvider,
  useCheckout,
  usePaymentElement,
  usePlans,
} from "@clerk/nextjs/experimental";
import { useDevAuthBypass } from "@/components/dev-auth-bypass-provider";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Period = "month" | "annual";
type Step = "plan" | "account" | "payment";

const steps: { key: Step; title: string; description: string }[] = [
  { key: "plan", title: "Choose a plan", description: "Find the right fit" },
  { key: "account", title: "Your account", description: "Subscribe or sign in" },
  { key: "payment", title: "Payment", description: "Complete checkout" },
];

const authAppearance = {
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", boxShadow: "none", border: "1px solid #edf0ea" },
  },
};

function money(amount: { currencySymbol: string; amountFormatted: string }) {
  return `${amount.currencySymbol}${amount.amountFormatted}`;
}

export function Subscribe({ step = "plan" }: { step?: Step }) {
  const { isLoaded, isSignedIn } = useAuth();
  const devAuthBypassEnabled = useDevAuthBypass();
  const params = useSearchParams();
  const selectedId = params.get("plan");
  const period: Period = params.get("period") === "annual" ? "annual" : "month";
  const authMode = params.get("auth") === "sign-in" ? "sign-in" : "sign-up";
  const [chosenPeriod, setChosenPeriod] = useState<Period>(period);
  const plans = usePlans({ for: "user", pageSize: 10, infinite: true });

  const query = selectedId
    ? `plan=${encodeURIComponent(selectedId)}&period=${period}`
    : "";
  const accountUrl = `/subscribe/account?${query}`;
  const paymentUrl = `/subscribe/payment?${query}`;
  const stepIndex = steps.findIndex((item) => item.key === step);

  return (
    <div className="site-shell">
      <main className="main-content">
        <div className="checkout-security">
          <span className="secure-label">
            <span>●</span> SECURE CHECKOUT
          </span>
        </div>
        {devAuthBypassEnabled && isLoaded && !isSignedIn && (
          <p className="dev-auth-notice" role="status">
            Development access is enabled for member content. Account
            management and checkout still require a Clerk sign-in.
          </p>
        )}
        <nav className="progress" aria-label="Subscription progress">
          <ol>
            {steps.map((item, index) => {
              const completed =
                index < stepIndex &&
                (item.key === "plan"
                  ? !!selectedId
                  : item.key === "account" && !!isSignedIn);
              return (
                <li
                  key={item.key}
                  className={
                    index === stepIndex
                      ? "current"
                      : completed
                        ? "completed"
                        : ""
                  }
                  aria-current={index === stepIndex ? "step" : undefined}
                >
                  <span className="progress-number">
                    {completed ? "✓" : `0${index + 1}`}
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="checkout-layout">
          <section className="flow-panel">
            {step === "plan" && (
              <>
                <div className="section-heading">
                  <span className="step-number">01</span>
                  <div>
                    <h2>Choose your plan</h2>
                    <p>Find the right fit for you.</p>
                  </div>
                </div>
                <div className="period-toggle" aria-label="Billing period">
                  <button
                    type="button"
                    className={chosenPeriod === "month" ? "active" : ""}
                    aria-pressed={chosenPeriod === "month"}
                    onClick={() => setChosenPeriod("month")}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    className={chosenPeriod === "annual" ? "active" : ""}
                    aria-pressed={chosenPeriod === "annual"}
                    onClick={() => setChosenPeriod("annual")}
                  >
                    Yearly
                  </button>
                </div>
                {plans.isLoading && (
                  <p className="status-message">Loading available plans...</p>
                )}
                {plans.isError && (
                  <p className="error-message" role="alert">
                    Couldn&apos;t load plans. Please refresh the page and try
                    again.
                  </p>
                )}
                {!plans.isLoading &&
                  !plans.isError &&
                  plans.data?.length === 0 && (
                    <p className="status-message">
                      No plans are available yet. Please check back soon.
                    </p>
                  )}
                <div className="plans">
                  {plans.data?.map((plan) => {
                    const price =
                      chosenPeriod === "annual" ? plan.annualFee : plan.fee;
                    const available =
                      chosenPeriod === "month"
                        ? !!plan.fee || !plan.hasBaseFee
                        : !!plan.annualFee;
                    return (
                      <article className="plan-card" key={plan.id}>
                        <div className="plan-top">
                          <div>
                            <h3>{plan.name}</h3>
                            <p>
                              {plan.description || "A membership made for you."}
                            </p>
                          </div>
                          <span className="plan-sparkle">✳</span>
                        </div>
                        <div className="plan-price">
                          {price
                            ? money(price)
                            : available
                              ? "Free"
                              : "Unavailable"}
                          {price && (
                            <span>
                              {" "}
                              / {chosenPeriod === "month" ? "month" : "year"}
                            </span>
                          )}
                        </div>
                        {plan.freeTrialEnabled && plan.freeTrialDays && (
                          <p className="trial-note">
                            {plan.freeTrialDays}-day free trial, if eligible
                          </p>
                        )}
                        {plan.features.length > 0 && (
                          <ul className="features">
                            {plan.features.map((feature) => (
                              <li key={feature.id}>
                                <span>✓</span>
                                {feature.name}
                              </li>
                            ))}
                          </ul>
                        )}
                        {available ? (
                          <Link
                            className="primary-button"
                            href={`/subscribe/account?plan=${encodeURIComponent(plan.id)}&period=${chosenPeriod}`}
                          >
                            Choose this plan <span>↗</span>
                          </Link>
                        ) : (
                          <button className="primary-button" disabled>
                            Not available yearly <span>↗</span>
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
                {plans.hasNextPage && (
                  <button
                    className="text-button"
                    onClick={() => plans.fetchNext()}
                  >
                    Load more plans +
                  </button>
                )}
                {selectedId && (
                  <p className="resume-checkout">
                    Already chose a plan?{" "}
                    <Link href={accountUrl}>Continue checkout →</Link>
                  </p>
                )}
              </>
            )}

            {step === "account" && (
              <>
                <Link href="/" className="back-link">
                  ← Back to plans
                </Link>
                <div className="section-heading">
                  <span className="step-number">02</span>
                  <div>
                    <h2>Your account</h2>
                    <p>Subscribe to create an account, or sign in to continue.</p>
                  </div>
                </div>
                {!selectedId ? (
                  <div className="step-message">
                    <p>Please choose a plan before continuing.</p>
                    <Link className="primary-button" href="/">
                      View plans <span>↗</span>
                    </Link>
                  </div>
                ) : !isLoaded ? (
                  <p className="muted-indent">Loading your account...</p>
                ) : isSignedIn ? (
                  <div className="step-message">
                    <p className="complete-state">
                      <span>✓</span> You&apos;re signed in and ready to continue.
                    </p>
                    <Link className="primary-button" href={paymentUrl}>
                      Continue to payment <span>↗</span>
                    </Link>
                  </div>
                ) : (
                  <div className="auth-container">
                    <div className="auth-tabs">
                      <Link
                        scroll={false}
                        className={authMode === "sign-up" ? "active" : ""}
                        href={`${accountUrl}&auth=sign-up`}
                      >
                        Subscribe to create account
                      </Link>
                      <Link
                        scroll={false}
                        className={authMode === "sign-in" ? "active" : ""}
                        href={`${accountUrl}&auth=sign-in`}
                      >
                        Sign in
                      </Link>
                    </div>
                    {authMode === "sign-in" ? (
                      <SignIn
                        routing="hash"
                        forceRedirectUrl={paymentUrl}
                        signUpUrl={`${accountUrl}&auth=sign-up`}
                        appearance={authAppearance}
                      />
                    ) : (
                      <SignUp
                        routing="hash"
                        forceRedirectUrl={paymentUrl}
                        signInUrl={`${accountUrl}&auth=sign-in`}
                        appearance={authAppearance}
                      />
                    )}
                  </div>
                )}
              </>
            )}

            {step === "payment" && (
              <>
                {!selectedId ? (
                  <div className="step-message">
                    <p>Please choose a plan before continuing.</p>
                    <Link className="primary-button" href="/">
                      View plans <span>↗</span>
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="selection-row">
                      <div>
                        <strong>
                          {plans.data?.find((plan) => plan.id === selectedId)
                            ?.name || "Selected plan"}
                        </strong>
                        <span>
                          {period === "month" ? "Monthly" : "Yearly"} billing
                        </span>
                      </div>
                      <Link href="/" className="text-button">
                        Change
                      </Link>
                    </div>
                    {!isLoaded ? (
                      <p className="muted-indent">Loading your account...</p>
                    ) : isSignedIn ? (
                      <CheckoutProvider
                        key={`${selectedId}-${period}`}
                        for="user"
                        planId={selectedId}
                        planPeriod={period}
                      >
                        <Checkout />
                      </CheckoutProvider>
                    ) : (
                      <div className="step-message">
                        <p>
                          Sign in or create an account before entering payment
                          details.
                        </p>
                        <Link href={accountUrl} className="primary-button">
                          Continue to account <span>↗</span>
                        </Link>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </div>
        <footer className="site-footer">
          <span>© {new Date().getFullYear()} MEMBERSHIP</span>
          <span>YOUR NEXT CHAPTER STARTS HERE ↗</span>
        </footer>
      </main>
    </div>
  );
}

function Checkout() {
  const { checkout, fetchStatus } = useCheckout();
  const [error, setError] = useState("");

  async function start() {
    setError("");
    try {
      const result = await checkout.start();
      if (result.error)
        setError(result.error.longMessage || result.error.message);
    } catch (err) {
      console.error("Unable to start checkout", err);
      setError("Unable to start checkout. Please try again.");
    }
  }

  if (checkout.status === "needs_initialization") {
    return (
      <div className="checkout-content">
        <p>Review your total and enter your payment details securely.</p>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button"
          onClick={start}
          disabled={fetchStatus === "fetching"}
        >
          {fetchStatus === "fetching"
            ? "Preparing checkout..."
            : "Continue to payment"}{" "}
          <span>↗</span>
        </button>
      </div>
    );
  }

  return (
    <div className="checkout-content">
      <div className="checkout-summary">
        <span>
          {checkout.plan.name} ·{" "}
          {checkout.planPeriod === "month" ? "Monthly" : "Yearly"}
        </span>
        <strong>
          Due today:{" "}
          {checkout.totals.totalDueNow
            ? money(checkout.totals.totalDueNow)
            : "See payment details"}
        </strong>
      </div>
      {checkout.totals.totalDuePerPeriod && (
        <p className="renewal-note">
          Renews at {money(checkout.totals.totalDuePerPeriod)} per{" "}
          {checkout.planPeriod === "month" ? "month" : "year"} unless canceled.
        </p>
      )}
      {checkout.freeTrialEndsAt && (
        <p className="renewal-note">
          Trial ends {new Date(checkout.freeTrialEndsAt).toLocaleDateString()}.
        </p>
      )}
      {!checkout.needsPaymentMethod ? (
        <PaymentForm />
      ) : (
        <PaymentElementProvider checkout={checkout}>
          <PaymentForm withPayment />
        </PaymentElementProvider>
      )}
    </div>
  );
}

function PaymentForm({ withPayment = false }: { withPayment?: boolean }) {
  return withPayment ? <NewPaymentForm /> : <ConfirmPayment />;
}

function NewPaymentForm() {
  const { submit, isFormReady } = usePaymentElement();
  return (
    <ConfirmPayment submitPayment={submit} ready={isFormReady}>
      <PaymentElement fallback={<p>Loading secure payment form...</p>} />
    </ConfirmPayment>
  );
}

function ConfirmPayment({
  submitPayment,
  ready = true,
  children,
}: {
  submitPayment?: ReturnType<typeof usePaymentElement>["submit"];
  ready?: boolean;
  children?: React.ReactNode;
}) {
  const { checkout, fetchStatus } = useCheckout();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      (!ready && checkout.status !== "completed") ||
      processing ||
      fetchStatus === "fetching"
    )
      return;
    setProcessing(true);
    setError("");
    try {
      if (checkout.status !== "completed") {
        let payment: { gateway: "stripe"; paymentToken: string } | undefined;
        if (submitPayment) {
          const result = await submitPayment();
          if (result.error) {
            setError(
              result.error.error.message ||
                "Please check your payment details.",
            );
            return;
          }
          payment = result.data;
        }
        const result = await checkout.confirm(payment || {});
        if (result.error) {
          setError(result.error.longMessage || result.error.message);
          return;
        }
      }
      const result = await checkout.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl("/account");
          if (url.startsWith("http")) window.location.href = url;
          else router.push(url);
        },
      });
      if (result.error)
        setError(result.error.longMessage || result.error.message);
    } catch (err) {
      console.error("Checkout failed", err);
      setError("We couldn't complete checkout. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={submit} className="payment-form">
      {checkout.status !== "completed" && children}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="primary-button"
        disabled={
          (!ready && checkout.status !== "completed") ||
          processing ||
          fetchStatus === "fetching"
        }
      >
        {processing || fetchStatus === "fetching"
          ? "Processing..."
          : checkout.status === "completed"
            ? "Finish checkout"
            : "Complete subscription"}{" "}
        <span>↗</span>
      </button>
      <p className="payment-note">
        Your payment information is securely handled by Clerk and Stripe.
      </p>
    </form>
  );
}
