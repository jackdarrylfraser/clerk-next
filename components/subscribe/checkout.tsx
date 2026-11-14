"use client";

import {
  CheckoutProvider,
  PaymentElement,
  PaymentElementProvider,
  useCheckout,
  usePaymentElement,
} from "@clerk/nextjs/experimental";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Period } from "./types";
import { money } from "./types";

export function Checkout({
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
