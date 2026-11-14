"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { usePlans } from "@clerk/nextjs/experimental";
import { use } from "react";
import { useAuth } from "@clerk/nextjs";
import { useDevAuthBypass } from "@/components/dev-auth-bypass-provider";
import { useRouter } from "next/navigation";
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

export default function SubscribePage({
  searchParams,
}: PageProps<"/subscribe">) {
  return (
    <Suspense
      fallback={
        <main className="loading-page">Loading subscription options...</main>
      }
    >
      <SubscribePlanContent searchParams={searchParams} />
    </Suspense>
  );
}

function SubscribePlanContent({
  searchParams,
}: {
  searchParams: Promise<SubscribeSearchParams>;
}) {
  const query = parseSubscribeQuery(use(searchParams));
  const router = useRouter();
  const plans = usePlans({ for: "user", pageSize: 10, infinite: true });
  const { isLoaded, isSignedIn } = useAuth();
  const devAuthBypassEnabled = useDevAuthBypass();
  const matchingPlan = plans.data?.find((plan) => plan.id === query.plan);
  const selectedPlanState = getSelectedPlanState({
    plan: matchingPlan,
    period: query.period,
    isLoading: plans.isLoading,
    hasMore: plans.hasNextPage,
    hasError: plans.isError,
  });
  const urls = getSubscribeUrls(query.plan, query.period);
  const decision = resolveSubscribeFlow({
    step: "plan",
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
      matchingPlan ||
      plans.isError ||
      !plans.hasNextPage
    ) {
      return;
    }

    void fetchNextPlans();
  }, [
    fetchNextPlans,
    matchingPlan,
    plans.hasNextPage,
    plans.isError,
    query.plan,
  ]);

  useEffect(() => {
    if (redirectUrl) router.replace(redirectUrl);
  }, [redirectUrl, router]);

  function selectPeriod(period: "month" | "annual"): void {
    router.replace(getSubscribeUrls(query.plan, period).plans);
  }

  function selectPlan(planId: string): void {
    router.push(getSubscribeUrls(planId, query.period).payment);
  }

  return (
    <SubscribeLayout
      step="plan"
      selectedId={query.plan}
      urls={urls}
      isLoaded={isLoaded}
      isSignedIn={!!isSignedIn}
      devAuthBypassEnabled={devAuthBypassEnabled}
    >
      {decision.kind === "redirect" ? (
        <p className="muted-indent" role="status">
          Taking you to the next step...
        </p>
      ) : decision.kind === "loading" ? (
        <p className="muted-indent" role="status">
          {decision.reason === "account"
            ? "Loading your account..."
            : "Loading your selected plan..."}
        </p>
      ) : (
        <PlanStep
          plans={plans.data}
          isLoading={plans.isLoading}
          isError={plans.isError}
          hasNextPage={plans.hasNextPage}
          fetchNext={() => {
            void plans.fetchNext();
          }}
          chosenPeriod={query.period}
          onPeriodChange={selectPeriod}
          selectedId={query.plan}
          paymentUrl={urls.payment}
          canResumeCheckout={selectedPlanState.status === "ready"}
          onChoosePlan={selectPlan}
        />
      )}
    </SubscribeLayout>
  );
}

function PlanStep({
  plans,
  isLoading,
  isError,
  hasNextPage,
  fetchNext,
  chosenPeriod,
  onPeriodChange,
  selectedId,
  paymentUrl,
  canResumeCheckout,
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
  paymentUrl: string;
  canResumeCheckout: boolean;
  onChoosePlan: (planId: string) => void;
}) {
  return (
    <>
      {plans?.length ? null : (
        <PeriodToggle
          chosenPeriod={chosenPeriod}
          onPeriodChange={onPeriodChange}
        />
      )}
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
        {plans?.map((plan, index) => {
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
                {index === 0 ? (
                  <PeriodToggle
                    chosenPeriod={chosenPeriod}
                    onPeriodChange={onPeriodChange}
                  />
                ) : (
                  <span className="plan-sparkle">✳</span>
                )}
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
      {selectedId && canResumeCheckout && (
        <p className="resume-checkout">
          Already chose a plan? <Link href={paymentUrl}>Continue checkout →</Link>
        </p>
      )}
    </>
  );
}

function PeriodToggle({
  chosenPeriod,
  onPeriodChange,
}: {
  chosenPeriod: Period;
  onPeriodChange: (period: Period) => void;
}) {
  return (
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
  );
}
