"use client";

import { useAuth } from "@clerk/nextjs";
import { usePlans } from "@clerk/nextjs/experimental";
import { useDevAuthBypass } from "@/components/dev-auth-bypass-provider";
import {
  acceptPlanTerms,
  clearPlanTermsAcceptances,
  getPlanTerms,
  hasAcceptedPlanTerms,
  planTermsAcceptancePrefix,
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
import type { Period, Step } from "./subscribe/types";

export function Subscribe({ step = "plan" }: { step?: Step }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const devAuthBypassEnabled = useDevAuthBypass();
  const params = useSearchParams();
  const router = useRouter();
  const selectedId = params.get("plan");
  const period: Period = params.get("period") === "annual" ? "annual" : "month";
  const authMode = params.get("auth") === "sign-in" ? "sign-in" : "sign-up";
  const [chosenPeriod, setChosenPeriod] = useState<Period>(period);
  const [agreement, setAgreement] = useState<{
    key: string;
    checked: boolean;
  } | null>(null);
  const plans = usePlans({ for: "user", pageSize: 10, infinite: true });

  const query = selectedId
    ? `plan=${encodeURIComponent(selectedId)}&period=${period}`
    : "";
  const accountUrl = selectedId
    ? `/subscribe/account?${query}`
    : "/subscribe/account";
  const plansUrl = `/subscribe?period=${period}`;
  const termsUrl = selectedId
    ? `/subscribe/terms?${query}`
    : "/subscribe/terms";
  const selectedPlan = plans.data?.find((plan) => plan.id === selectedId);
  const selectedPrice =
    selectedPlan &&
    (period === "annual" ? selectedPlan.annualFee : selectedPlan.fee);
  const selectedPlanTerms = selectedId ? getPlanTerms(selectedId) : null;
  const PlanTermsContent = selectedPlanTerms?.content;
  const acceptanceKey =
    selectedPlan && selectedId && selectedPlanTerms && userId
      ? `${planTermsAcceptancePrefix}${encodeURIComponent(
          [
            userId,
            selectedId,
            period,
            selectedPlanTerms.version,
            selectedPrice
              ? `${selectedPrice.currencySymbol}${selectedPrice.amountFormatted}`
              : "free",
            selectedPlan.freeTrialEnabled
              ? (selectedPlan.freeTrialDays ?? 0)
              : 0,
          ].join("|"),
        )}`
      : null;
  const termsAccepted = useSyncExternalStore(
    subscribeToPlanTermsAcceptance,
    () => hasAcceptedPlanTerms(acceptanceKey),
    () => false,
  );
  const agreementChecked =
    termsAccepted ||
    (!!acceptanceKey && agreement?.key === acceptanceKey && agreement.checked);
  const planAvailable =
    !!selectedPlan &&
    (period === "month"
      ? !!selectedPlan.fee || !selectedPlan.hasBaseFee
      : !!selectedPlan.annualFee);
  const fetchNextPlans = plans.fetchNext;

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

  function continueToPayment() {
    if (!acceptanceKey || !agreementChecked || !isSignedIn) return;

    acceptPlanTerms(acceptanceKey);
    router.push(paymentUrl);
  }

  const paymentUrl = selectedId
    ? `/subscribe/payment?${query}`
    : "/subscribe/payment";

  return (
    <SubscribeLayout
      step={step}
      selectedId={selectedId}
      isLoaded={isLoaded}
      isSignedIn={!!isSignedIn}
      termsAccepted={termsAccepted}
      devAuthBypassEnabled={devAuthBypassEnabled}
    >
      {step === "plan" && (
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
          accountUrl={accountUrl}
          onClearTermsAcceptance={clearTermsAcceptance}
        />
      )}
      {step === "account" && (
        <AccountStep
          selectedId={selectedId}
          isLoaded={isLoaded}
          isSignedIn={!!isSignedIn}
          authMode={authMode}
          plansUrl={plansUrl}
          accountUrl={accountUrl}
          termsUrl={termsUrl}
          onClearTermsAcceptance={clearTermsAcceptance}
        />
      )}
      {step === "terms" && (
        <TermsStep
          selectedId={selectedId}
          isLoaded={isLoaded}
          isSignedIn={!!isSignedIn}
          isPlanError={plans.isError}
          isPlanLoading={plans.isLoading}
          hasMorePlans={plans.hasNextPage}
          selectedPlan={selectedPlan}
          selectedPrice={selectedPrice}
          period={period}
          planAvailable={planAvailable}
          accountUrl={accountUrl}
          plansUrl={plansUrl}
          agreementChecked={agreementChecked}
          PlanTermsContent={PlanTermsContent}
          onAgreementChange={changeAgreement}
          onContinue={continueToPayment}
          onClearTermsAcceptance={clearTermsAcceptance}
        />
      )}
      {step === "payment" && (
        <PaymentStep
          selectedId={selectedId}
          isLoaded={isLoaded}
          isSignedIn={!!isSignedIn}
          selectedPlan={selectedPlan}
          isPlanLoading={plans.isLoading}
          hasMorePlans={plans.hasNextPage}
          planAvailable={planAvailable}
          termsAccepted={termsAccepted}
          period={period}
          accountUrl={accountUrl}
          termsUrl={termsUrl}
          plansUrl={plansUrl}
          onClearTermsAcceptance={clearTermsAcceptance}
        />
      )}
    </SubscribeLayout>
  );
}
