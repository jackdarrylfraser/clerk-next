"use client";

import Link from "next/link";
import { Suspense, use, useEffect, useState } from "react";
import { usePlans } from "@clerk/nextjs/experimental";
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
}: PageProps<"/subscribe/plan">) {
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

  function selectPlan(planId: string, period: Period): void {
    const urls = getSubscribeUrls(planId, period);
    router.push(isSignedIn ? urls.payment : urls.account);
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
  selectedId: string | null;
  paymentUrl: string;
  canResumeCheckout: boolean;
  onChoosePlan: (planId: string, period: Period) => void;
}) {
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const availablePlans = plans ?? [];
  const activePlanIndex = Math.max(
    availablePlans.findIndex((plan) => plan.id === activePlanId),
    0,
  );
  const activePlan = availablePlans[activePlanIndex];
  const annualDiscount =
    activePlan?.fee &&
    activePlan.annualMonthlyFee &&
    activePlan.fee.currency === activePlan.annualMonthlyFee.currency &&
    activePlan.fee.amount > 0
      ? Math.round(
          (1 -
            activePlan.annualMonthlyFee.amount / activePlan.fee.amount) *
            100,
        )
        : 0;

  return (
    <>
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
      {activePlan && (
        <>
          <div className="plan-tabs" role="group" aria-label="Choose a plan">
            {availablePlans.map((plan, index) => {
              const isActive = index === activePlanIndex;

              return (
                <button
                  key={plan.id}
                  type="button"
                  className={`plan-tab${isActive ? " active" : ""}`}
                  aria-pressed={isActive}
                  onClick={() => setActivePlanId(plan.id)}
                >
                  {plan.name}
                </button>
              );
            })}
          </div>
          <article className="plan-card">
            <div className="plan-top">
              <div>
                <h3>{activePlan.name}</h3>
                <p>
                  {activePlan.description || "A membership made for you."}
                </p>
              </div>
            </div>
            {activePlan.freeTrialEnabled && activePlan.freeTrialDays && (
              <p className="trial-note">
                {activePlan.freeTrialDays}-day free trial, if eligible
              </p>
            )}
            {activePlan.features.length > 0 && (
              <ul className="features">
                {activePlan.features.map((feature) => (
                  <li key={feature.id}>
                    <span>✓</span>
                    {feature.name}
                  </li>
                ))}
              </ul>
            )}
            <div className="billing-options">
              {(["month", "annual"] as const).map((period) => {
                const isAnnual = period === "annual";
                const amount = isAnnual
                  ? activePlan.annualMonthlyFee ?? activePlan.annualFee
                  : activePlan.fee;
                const isAvailable = isAnnual
                  ? !!activePlan.annualFee
                  : !!activePlan.fee || !activePlan.hasBaseFee;

                return (
                  <div
                    className="billing-option"
                    key={period}
                  >
                    <div className="billing-option-heading">
                      <h4>{isAnnual ? "Annual" : "Monthly"}</h4>
                      {isAnnual && annualDiscount > 0 && (
                        <span className="discount-badge">
                          Save {annualDiscount}%
                        </span>
                      )}
                    </div>
                    <div className="billing-price">
                      {amount
                        ? money(amount)
                        : !isAnnual && !activePlan.hasBaseFee
                          ? "Free"
                          : "Unavailable"}
                      {amount && (
                        <span>
                          {" "}
                          / {isAnnual && !activePlan.annualMonthlyFee
                            ? "year"
                            : "month"}
                        </span>
                      )}
                    </div>
                    {isAnnual &&
                      activePlan.annualMonthlyFee &&
                      activePlan.annualFee && (
                        <p className="billing-note">
                          Billed annually at {money(activePlan.annualFee)}
                        </p>
                      )}
                    <button
                      type="button"
                      className="primary-button"
                      disabled={!isAvailable}
                      onClick={() => onChoosePlan(activePlan.id, period)}
                    >
                      {isAvailable
                        ? `Choose ${isAnnual ? "annual" : "monthly"}`
                        : `Not available ${isAnnual ? "yearly" : "monthly"}`}
                      <span>↗</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </article>
        </>
      )}
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
