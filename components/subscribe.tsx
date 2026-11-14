"use client";

import { useAuth } from "@clerk/nextjs";
import { usePlans } from "@clerk/nextjs/experimental";
import { useDevAuthBypass } from "@/components/dev-auth-bypass-provider";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountStep } from "./subscribe/account-step";
import { PaymentStep } from "./subscribe/payment-step";
import { PlanStep } from "./subscribe/plan-step";
import { SubscribeLayout } from "./subscribe/subscribe-layout";
import {
  getSelectedPlanState,
  getSubscribeUrls,
  parseSubscribeQuery,
  resolveSubscribeFlow,
} from "./subscribe/flow-state";
import type { Period, Step } from "./subscribe/types";

export function Subscribe({ step = "plan" }: { step?: Step }) {
  const { isLoaded, isSignedIn } = useAuth();
  const devAuthBypassEnabled = useDevAuthBypass();
  const params = useSearchParams();
  const router = useRouter();
  const query = parseSubscribeQuery({
    plan: params.get("plan"),
    period: params.get("period"),
    auth: params.get("auth"),
  });
  const { plan: selectedId, period, auth: authMode } = query;
  const [chosenPeriod, setChosenPeriod] = useState<Period>(period);
  const plans = usePlans({ for: "user", pageSize: 10, infinite: true });

  const urls = getSubscribeUrls(selectedId, period);
  const matchingPlan = plans.data?.find((plan) => plan.id === selectedId);
  const selectedPlanState = getSelectedPlanState({
    plan: matchingPlan,
    period,
    isLoading: plans.isLoading,
    hasMore: plans.hasNextPage,
    hasError: plans.isError,
  });
  const selectedPlan =
    "plan" in selectedPlanState ? selectedPlanState.plan : undefined;
  const fetchNextPlans = plans.fetchNext;
  const decision = resolveSubscribeFlow({
    step,
    planId: selectedId,
    urls,
    selectedPlanStatus: selectedPlanState.status,
    isAuthLoaded: isLoaded,
    isSignedIn: !!isSignedIn,
  });
  const redirectUrl = decision.kind === "redirect" ? decision.href : null;

  useEffect(() => {
    if (
      !selectedId ||
      step !== "payment" ||
      selectedPlan ||
      plans.isError ||
      !plans.hasNextPage
    ) {
      return;
    }

    void fetchNextPlans();
  }, [
    plans.data,
    fetchNextPlans,
    plans.hasNextPage,
    plans.isError,
    selectedId,
    selectedPlan,
    step,
  ]);

  useEffect(() => {
    if (!redirectUrl) return;
    router.replace(redirectUrl);
  }, [redirectUrl, router]);

  return (
    <SubscribeLayout
      step={step}
      selectedId={selectedId}
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
      ) : step === "plan" ? (
        <PlanStep
          plans={plans.data}
          isLoading={plans.isLoading}
          isError={plans.isError}
          hasNextPage={plans.hasNextPage}
          fetchNext={() => {
            void plans.fetchNext();
          }}
          chosenPeriod={chosenPeriod}
          onPeriodChange={setChosenPeriod}
          selectedId={selectedId}
          accountUrl={urls.account}
        />
      ) : step === "account" ? (
        <AccountStep
          isSignedIn={!!isSignedIn}
          authMode={authMode}
          plansUrl={urls.plans}
          accountUrl={urls.account}
          paymentUrl={urls.payment}
        />
      ) : step === "payment" && selectedPlan ? (
        <PaymentStep
          selectedPlan={selectedPlan}
          period={period}
          accountUrl={urls.account}
          plansUrl={urls.plans}
        />
      ) : null}
    </SubscribeLayout>
  );
}
