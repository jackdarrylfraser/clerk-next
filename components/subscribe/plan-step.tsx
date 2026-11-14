import Link from "next/link";
import type { Plan, Period } from "./types";
import { money } from "./types";

export function PlanStep({
  plans,
  isLoading,
  isError,
  hasNextPage,
  fetchNext,
  chosenPeriod,
  onPeriodChange,
  selectedId,
  accountUrl,
  onChoosePlan,
}: {
  plans: Plan[] | undefined;
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  fetchNext: () => void;
  chosenPeriod: Period;
  onPeriodChange: (period: Period) => void;
  selectedId: string | null;
  accountUrl: string;
  onChoosePlan: (planId: string) => void;
}) {
  return (
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
          onClick={() => onPeriodChange("month")}
        >
          Monthly
        </button>
        <button
          type="button"
          className={chosenPeriod === "annual" ? "active" : ""}
          aria-pressed={chosenPeriod === "annual"}
          onClick={() => onPeriodChange("annual")}
        >
          Yearly
        </button>
      </div>
      {isLoading && (
        <p className="status-message">Loading available plans...</p>
      )}
      {isError && (
        <p className="error-message" role="alert">
          Couldn&apos;t load plans. Please refresh the page and try again.
        </p>
      )}
      {!isLoading && !isError && plans?.length === 0 && (
        <p className="status-message">
          No plans are available yet. Please check back soon.
        </p>
      )}
      <div className="plans">
        {plans?.map((plan) => {
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
                  <p>{plan.description || "A membership made for you."}</p>
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
                  <span> / {chosenPeriod === "month" ? "month" : "year"}</span>
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
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onChoosePlan(plan.id)}
                >
                  Choose this plan <span>↗</span>
                </button>
              ) : (
                <button className="primary-button" disabled>
                  Not available yearly <span>↗</span>
                </button>
              )}
            </article>
          );
        })}
      </div>
      {hasNextPage && (
        <button className="text-button" onClick={fetchNext}>
          Load more plans +
        </button>
      )}
      {selectedId && (
        <p className="resume-checkout">
          Already chose a plan? <Link href={accountUrl}>Continue checkout →</Link>
        </p>
      )}
    </>
  );
}
