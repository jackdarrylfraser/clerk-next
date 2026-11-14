"use client";

import { Suspense } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  CheckoutProvider,
  PaymentElement,
  PaymentElementProvider,
  useCheckout,
  usePaymentElement,
  usePlans,
} from "@clerk/nextjs/experimental";
import { useDevAuthBypass } from "@/components/dev-auth-bypass-provider";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getSelectedPlanState,
  getSubscribeUrls,
  parseSubscribeQuery,
  resolveSubscribeFlow,
} from "@/components/subscribe/flow-state";
import { SubscribeLayout } from "@/components/subscribe/subscribe-layout";
import type {
  Period,
  Plan,
  SubscribeSearchParams,
} from "@/components/subscribe/types";
import { money } from "@/components/subscribe/types";

export default function SubscribePaymentPage({
  searchParams,
}: PageProps<"/subscribe/payment">) {
  return (
    <Suspense fallback={<main className="loading-page">Loading payment step...</main>}>
      <SubscribePaymentContent searchParams={searchParams} />
    </Suspense>
  );
}

function SubscribePaymentContent({
  searchParams,
}: {
  searchParams: Promise<SubscribeSearchParams>;
}) {
  const query = parseSubscribeQuery(use(searchParams));
  const { isLoaded, isSignedIn } = useAuth();
  const devAuthBypassEnabled = useDevAuthBypass();
  const router = useRouter();
  const plans = usePlans({ for: "user", pageSize: 10, infinite: true });
  const matchingPlan = plans.data?.find(
    (plan) => plan.id === query.plan,
  );
  const selectedPlanState = getSelectedPlanState({
    plan: matchingPlan,
    period: query.period,
    isLoading: plans.isLoading,
    hasMore: plans.hasNextPage,
    hasError: plans.isError,
  });
  const selectedPlan =
    "plan" in selectedPlanState ? selectedPlanState.plan : undefined;
  const urls = getSubscribeUrls(query.plan, query.period);
  const decision = resolveSubscribeFlow({
    step: "payment",
    planId: query.plan,
    urls,
    selectedPlanStatus: selectedPlanState.status,
    isAuthLoaded: isLoaded,
    isSignedIn: !!isSignedIn,
  });
  const redirectUrl = decision.kind === "redirect" ? decision.href : null;
  const fetchNextPlans = plans.fetchNext;

  useEffect(() => {
    if (
        !query.plan ||
        selectedPlan ||
        plans.isError ||
      !plans.hasNextPage
    ) {
      return;
    }

    void fetchNextPlans();
  }, [
    fetchNextPlans,
    plans.hasNextPage,
    plans.isError,
    selectedPlan,
    query.plan,
  ]);

  useEffect(() => {
    if (redirectUrl) router.replace(redirectUrl);
  }, [redirectUrl, router]);

  return (
    <SubscribeLayout
      step="payment"
      selectedId={query.plan}
      isLoaded={isLoaded}
      isSignedIn={!!isSignedIn}
      devAuthBypassEnabled={devAuthBypassEnabled}
    >
      {decision.kind === "redirect" ? (
        <p className="muted-indent" role="status">
          Taking you to the right step...
        </p>
      ) : decision.kind === "loading" ? (
        <p className="muted-indent">
          {decision.reason === "account"
            ? "Loading your account..."
            : "Loading your selected plan..."}
        </p>
      ) : selectedPlan ? (
        <PaymentStep
          selectedPlan={selectedPlan}
          period={query.period}
          accountUrl={urls.account}
          plansUrl={urls.plans}
        />
      ) : null}
    </SubscribeLayout>
  );
}

function PaymentStep({
  selectedPlan,
  period,
  accountUrl,
  plansUrl,
}: {
  selectedPlan: Plan;
  period: Period;
  accountUrl: string;
  plansUrl: string;
}) {
  return (
    <>
      <Link href={accountUrl} className="back-link">
        ← Back to your account
      </Link>
      <div className="selection-row">
        <div>
          <strong>{selectedPlan.name}</strong>
          <span>{period === "month" ? "Monthly" : "Yearly"} billing</span>
        </div>
        <Link href={plansUrl} className="text-button">
          Change
        </Link>
      </div>
      <Checkout selectedId={selectedPlan.id} period={period} />
    </>
  );
}

function Checkout({
  selectedId,
  period,
}: {
  selectedId: string;
  period: Period;
}) {
  return (
    <CheckoutProvider
      key={`${selectedId}-${period}`}
      for="user"
      planId={selectedId}
      planPeriod={period}
    >
      <CheckoutContent />
    </CheckoutProvider>
  );
}

function CheckoutContent() {
  const { checkout, fetchStatus } = useCheckout();
  const [error, setError] = useState("");

  async function start() {
    setError("");
    try {
      const result = await checkout.start();
      if (result.error) {
        setError(result.error.longMessage || result.error.message);
      }
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
        <ConfirmPayment />
      ) : (
        <PaymentElementProvider checkout={checkout}>
          <NewPaymentForm />
        </PaymentElementProvider>
      )}
    </div>
  );
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
  const [termsAccepted, setTermsAccepted] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      (!ready && checkout.status !== "completed") ||
      processing ||
      fetchStatus === "fetching" ||
      !termsAccepted
    ) {
      return;
    }

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
      if (result.error) {
        setError(result.error.longMessage || result.error.message);
      }
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
      <div className="checkout-legal">
        <input
          id="checkout-legal-agreement"
          type="checkbox"
          checked={termsAccepted}
          onChange={(event) => setTermsAccepted(event.currentTarget.checked)}
        />
        <span>
          <label htmlFor="checkout-legal-agreement">I agree to the</label>{" "}
          <Link href="/terms-of-service">Terms of Service</Link> and{" "}
          <Link href="/privacy-policy">Privacy Policy</Link>.
        </span>
      </div>
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
          fetchStatus === "fetching" ||
          !termsAccepted
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
