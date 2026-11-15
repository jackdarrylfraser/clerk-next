"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  StripeAccountCustomer,
  StripeAccountSubscription,
} from "@/lib/stripe-account";

interface BillingManagementProps {
  customers: StripeAccountCustomer[];
}

export function BillingManagement({
  customers,
}: BillingManagementProps): React.JSX.Element {
  const router = useRouter();
  const [emails, setEmails] = useState<Record<string, string>>(() =>
    Object.fromEntries(customers.map((customer) => [customer.id, customer.email ?? ""])),
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function redirectToSubscriptionIfRequired(response: Response): boolean {
    if (!response.redirected) {
      return false;
    }

    router.replace("/subscribe/plan?required=true");
    return true;
  }

  async function submitBillingEmail(
    event: React.FormEvent<HTMLFormElement>,
    customer: StripeAccountCustomer,
  ): Promise<void> {
    event.preventDefault();
    const actionId = `email:${customer.id}`;
    setPendingAction(actionId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/stripe/account/billing-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          email: emails[customer.id] ?? "",
        }),
      });
      if (redirectToSubscriptionIfRequired(response)) return;
      const responseBody: unknown = await response.json();

      if (!response.ok) {
        setErrorMessage(
          getErrorMessage(responseBody) ??
            "Billing email could not be updated. Please try again.",
        );
        return;
      }

      setSuccessMessage("Billing email updated.");
      router.refresh();
    } catch (error) {
      console.error("Stripe billing email request failed", error);
      setErrorMessage("Billing email could not be updated. Please try again.");
    } finally {
      setPendingAction(null);
    }
  }

  async function changeCancellation(
    customerId: string,
    subscription: StripeAccountSubscription,
    action: "cancel" | "keep",
  ): Promise<void> {
    const actionId = `${action}:${subscription.id}`;
    setPendingAction(actionId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/stripe/account/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          subscriptionId: subscription.id,
          action,
        }),
      });
      if (redirectToSubscriptionIfRequired(response)) return;
      const responseBody: unknown = await response.json();

      if (!response.ok) {
        setErrorMessage(
          getErrorMessage(responseBody) ??
            "Subscription could not be updated. Please try again.",
        );
        return;
      }

      setSuccessMessage(
        action === "cancel"
          ? "Cancellation scheduled for the end of the current billing period."
          : "Your subscription will continue as usual.",
      );
      router.refresh();
    } catch (error) {
      console.error("Stripe subscription request failed", error);
      setErrorMessage("Subscription could not be updated. Please try again.");
    } finally {
      setPendingAction(null);
    }
  }

  async function updatePaymentMethod(customerId: string): Promise<void> {
    const actionId = `payment-method:${customerId}`;
    setPendingAction(actionId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/stripe/account/payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      if (redirectToSubscriptionIfRequired(response)) return;
      const responseBody: unknown = await response.json();

      if (!response.ok || !isPortalSessionResponse(responseBody)) {
        setErrorMessage(
          getErrorMessage(responseBody) ??
            "Payment method updates could not be started. Please try again.",
        );
        return;
      }

      window.location.assign(responseBody.url);
    } catch (error) {
      console.error("Stripe payment-method request failed", error);
      setErrorMessage(
        "Payment method updates could not be started. Please try again.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="account-billing" aria-labelledby="account-billing-title">
      <div className="account-billing-heading">
        <div>
          <h2 id="account-billing-title">Billing</h2>
          <p>Manage your Stripe subscriptions and payment details.</p>
        </div>
      </div>

      {errorMessage && (
        <p className="account-billing-message error" role="alert">
          {errorMessage}
        </p>
      )}
      {successMessage && (
        <p className="account-billing-message success" role="status">
          {successMessage}
        </p>
      )}

      {customers.length === 0 ? (
        <div className="account-billing-empty">
          <p>No Stripe billing accounts are linked to your account yet.</p>
          <Link className="primary-button" href="/subscribe/plan">
            View subscription plans
          </Link>
        </div>
      ) : (
        <div className="account-billing-customers">
          {customers.map((customer) => (
            <section className="account-billing-customer" key={customer.id}>
              <div className="account-billing-customer-heading">
                <div>
                  <h3>Stripe billing account</h3>
                  <p className="account-customer-id">{customer.id}</p>
                </div>
                {!customer.deleted && (
                  <button
                    className="secondary-button"
                    disabled={pendingAction !== null}
                    onClick={() => updatePaymentMethod(customer.id)}
                    type="button"
                  >
                    {pendingAction === `payment-method:${customer.id}`
                      ? "Opening Stripe..."
                      : "Update payment method"}
                  </button>
                )}
              </div>

              {customer.deleted ? (
                <p className="account-billing-deleted" role="status">
                  This Stripe billing account is no longer available.
                </p>
              ) : (
                <form
                  className="account-billing-email-form"
                  onSubmit={(event) => submitBillingEmail(event, customer)}
                >
                  <label htmlFor={`billing-email-${customer.id}`}>
                    Billing email
                    <span>Separate from your Better Auth sign-in email.</span>
                  </label>
                  <div className="account-billing-email-controls">
                    <input
                      autoComplete="email"
                      disabled={pendingAction !== null}
                      id={`billing-email-${customer.id}`}
                      onChange={(event) =>
                        setEmails((current) => ({
                          ...current,
                          [customer.id]: event.target.value,
                        }))
                      }
                      required
                      type="email"
                      value={emails[customer.id] ?? ""}
                    />
                    <button
                      className="secondary-button"
                      disabled={
                        pendingAction !== null ||
                        (emails[customer.id] ?? "") === (customer.email ?? "")
                      }
                      type="submit"
                    >
                      {pendingAction === `email:${customer.id}`
                        ? "Saving..."
                        : "Save billing email"}
                    </button>
                  </div>
                </form>
              )}

              <div className="account-subscriptions">
                <h4>Subscriptions</h4>
                {customer.subscriptions.length === 0 ? (
                  <p className="account-billing-muted">
                    No subscriptions were found for this Stripe customer.
                  </p>
                ) : (
                  <div className="account-subscription-list">
                    {customer.subscriptions.map((subscription) => (
                      <article
                        className="account-subscription"
                        key={subscription.id}
                      >
                        <div className="account-subscription-top">
                          <div>
                            <h5>
                              {subscription.items
                                .map((item) => item.name)
                                .join(", ") || "Subscription"}
                            </h5>
                            <p className="account-subscription-price">
                              {subscription.items
                                .map((item) =>
                                  [
                                    item.price,
                                    item.interval,
                                    item.quantity > 1
                                      ? `quantity ${item.quantity}`
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" "),
                                )
                                .join(" · ") || "Price details unavailable"}
                            </p>
                          </div>
                          <span
                            className={`account-subscription-status ${subscription.cancellationScheduled ? "scheduled" : ""} ${subscription.status === "canceled" || subscription.status === "incomplete_expired" ? "ended" : ""}`}
                          >
                            {subscription.cancellationScheduled
                              ? "Cancellation scheduled"
                              : subscription.statusLabel}
                          </span>
                        </div>

                        {subscription.cancellationScheduled ? (
                          <div className="account-subscription-period">
                            <p>
                              {subscription.cancelAt !== null
                                ? `Cancels on ${formatDate(subscription.cancelAt)}.`
                                : subscription.currentPeriodEnd !== null
                                  ? `Cancels on ${formatDate(subscription.currentPeriodEnd)}.`
                                  : "Cancellation is scheduled for the end of the current billing period."}
                            </p>
                            <p>Access continues through the time already paid for.</p>
                          </div>
                        ) : subscription.endedAt !== null ? (
                          <p className="account-subscription-period">
                            Ended on {formatDate(subscription.endedAt)}.
                          </p>
                        ) : subscription.currentPeriodEnd !== null ? (
                          <p className="account-subscription-period">
                            Next renewal: {formatDate(subscription.currentPeriodEnd)}.
                          </p>
                        ) : null}

                        {subscription.canManageCancellation && (
                          <button
                            className="text-button account-subscription-action"
                            disabled={pendingAction !== null}
                            onClick={() =>
                              changeCancellation(
                                customer.id,
                                subscription,
                                subscription.cancellationScheduled
                                  ? "keep"
                                  : "cancel",
                              )
                            }
                            type="button"
                          >
                            {pendingAction ===
                            `${subscription.cancellationScheduled ? "keep" : "cancel"}:${subscription.id}`
                              ? "Updating..."
                              : subscription.cancellationScheduled
                                ? "Keep subscription"
                                : "Cancel at period end"}
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
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

function isPortalSessionResponse(
  value: unknown,
): value is { url: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof value.url === "string" &&
    value.url.length > 0
  );
}
