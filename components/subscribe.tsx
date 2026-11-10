"use client";

import { useAuth } from "@clerk/nextjs";
import { usePlans } from "@clerk/nextjs/experimental";
import { useDevAuthBypass } from "@/components/dev-auth-bypass-provider";
import {
  acceptPlanTerms,
  clearPlanTermsAcceptances,
  getPlanTerms,
  hasAcceptedPlanTerms,
  revokePlanTermsAcceptance,
  subscribeToPlanTermsAcceptance,
} from "@/lib/plan-terms";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AccountStep } from "./subscribe/account-step";
import { PaymentStep } from "./subscribe/payment-step";
import { PlanStep } from "./subscribe/plan-step";
import { SubscribeLayout } from "./subscribe/subscribe-layout";
import { TermsStep } from "./subscribe/terms-step";
import {
  getPlanTermsAcceptanceKey,
  getSelectedPlanState,
  getSubscribeUrls,
  parseSubscribeQuery,
  resolveSubscribeFlow,
} from "./subscribe/flow-state";
import type { Period, Step } from "./subscribe/types";

export function Subscribe({ step = "plan" }: { step?: Step }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
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
  const [agreement, setAgreement] = useState<{
    key: string;
    checked: boolean;
  } | null>(null);
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
  const selectedPrice =
    "price" in selectedPlanState ? selectedPlanState.price : undefined;
  const selectedPlanTerms = selectedPlan
    ? getPlanTerms(selectedPlan.slug)
    : null;
  const PlanTermsContent = selectedPlanTerms?.content;
  const acceptanceKey = getPlanTermsAcceptanceKey({
    planSlug: selectedPlan?.slug ?? null,
    userId,
    period,
    plan: selectedPlan,
    price: selectedPrice,
    terms: selectedPlanTerms,
  });
  const termsAccepted = useSyncExternalStore(
    subscribeToPlanTermsAcceptance,
    () => hasAcceptedPlanTerms(acceptanceKey),
    () => false,
  );
  const agreementChecked =
    termsAccepted ||
    (!!acceptanceKey && agreement?.key === acceptanceKey && agreement.checked);
  const fetchNextPlans = plans.fetchNext;
  const decision = resolveSubscribeFlow({
    step,
    planId: selectedId,
    urls,
    selectedPlanStatus: selectedPlanState.status,
    isAuthLoaded: isLoaded,
    isSignedIn: !!isSignedIn,
    termsAccepted,
  });
  const redirectUrl = decision.kind === "redirect" ? decision.href : null;
  const clearAcceptanceBeforeRedirect =
    decision.kind === "redirect" && decision.clearTermsAcceptance;

  useEffect(() => {
    if (
      !selectedId ||
      (step !== "terms" && step !== "payment") ||
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

    if (clearAcceptanceBeforeRedirect) {
      clearPlanTermsAcceptances();
    }
    router.replace(redirectUrl);
  }, [clearAcceptanceBeforeRedirect, redirectUrl, router]);

  function clearTermsAcceptance() {
    clearPlanTermsAcceptances();
  }

  function changeAgreement(checked: boolean) {
    if (!acceptanceKey) return;

    setAgreement({ key: acceptanceKey, checked });
    if (!checked) {
      revokePlanTermsAcceptance(acceptanceKey);
    }
  }

  const paymentUrl = urls.payment;

  function continueToPayment() {
    if (!acceptanceKey || !agreementChecked || !isSignedIn) return;

    acceptPlanTerms(acceptanceKey);
    router.push(paymentUrl);
  }

  return (
    <SubscribeLayout
      step={step}
      selectedId={selectedId}
      isLoaded={isLoaded}
      isSignedIn={!!isSignedIn}
      termsAccepted={termsAccepted}
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
          onClearTermsAcceptance={clearTermsAcceptance}
        />
      ) : step === "account" ? (
        <AccountStep
          isSignedIn={!!isSignedIn}
          authMode={authMode}
          plansUrl={urls.plans}
          accountUrl={urls.account}
          termsUrl={urls.terms}
          onClearTermsAcceptance={clearTermsAcceptance}
        />
      ) : step === "terms" && selectedPlan ? (
        <TermsStep
          selectedPlan={selectedPlan}
          selectedPrice={selectedPrice}
          period={period}
          plansUrl={urls.plans}
          agreementChecked={agreementChecked}
          PlanTermsContent={PlanTermsContent}
          onAgreementChange={changeAgreement}
          onContinue={continueToPayment}
          onClearTermsAcceptance={clearTermsAcceptance}
        />
      ) : step === "payment" && selectedPlan ? (
        <PaymentStep
          selectedPlan={selectedPlan}
          period={period}
          termsUrl={urls.terms}
          plansUrl={urls.plans}
          onClearTermsAcceptance={clearTermsAcceptance}
        />
      ) : null}
    </SubscribeLayout>
  );
}
