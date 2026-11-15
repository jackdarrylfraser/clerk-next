"use client";

import { useState } from "react";

interface CheckoutSessionResponse {
  url: string;
}

export function CheckoutButton() {
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function startCheckout(): Promise<void> {
    setIsStarting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/stripe/checkout", { method: "POST" });
      const responseBody: unknown = await response.json();

      if (!response.ok || !isCheckoutSessionResponse(responseBody)) {
        setErrorMessage(
          getErrorMessage(responseBody) ??
            "Checkout could not be started. Please try again.",
        );
        return;
      }

      window.location.assign(responseBody.url);
    } catch (error) {
      console.error("Stripe checkout request failed", error);
      setErrorMessage("Checkout could not be started. Please try again.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <>
      <button
        className="primary-button"
        disabled={isStarting}
        onClick={startCheckout}
        type="button"
      >
        {isStarting ? "Preparing secure checkout..." : "Continue to Stripe"}
        {!isStarting && <span>↗</span>}
      </button>
      {errorMessage && (
        <p className="guest-access-status error" role="alert">
          {errorMessage}
        </p>
      )}
    </>
  );
}

function isCheckoutSessionResponse(
  value: unknown,
): value is CheckoutSessionResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof value.url === "string" &&
    value.url.length > 0
  );
}

function getErrorMessage(value: unknown): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }

  return null;
}
