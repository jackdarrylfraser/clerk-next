import { z } from "zod";
import { planTermsAcceptancePrefix } from "@/lib/plan-terms";
import type { PlanTerms } from "@/lib/plan-terms";
import type { Plan, Period, Step } from "./types";

const subscribeQuerySchema = z.object({
  plan: z.string().nullable(),
  period: z.enum(["month", "annual"]).catch("month"),
  auth: z.enum(["sign-in", "sign-up"]).catch("sign-up"),
});

export function parseSubscribeQuery(query: {
  plan: string | null;
  period: string | null;
  auth: string | null;
}) {
  return subscribeQuerySchema.parse(query);
}

export function getSubscribeUrls(planId: string | null, period: Period) {
  const planQuery = planId
    ? `plan=${encodeURIComponent(planId)}&period=${period}`
    : null;

  return {
    plans: `/subscribe?period=${period}`,
    account: planQuery
      ? `/subscribe/account?${planQuery}`
      : "/subscribe/account",
    terms: planQuery ? `/subscribe/terms?${planQuery}` : "/subscribe/terms",
    payment: planQuery
      ? `/subscribe/payment?${planQuery}`
      : "/subscribe/payment",
  };
}

export function getSelectedPlanState({
  plan,
  period,
  isLoading,
  hasMore,
  hasError,
}: {
  plan: Plan | undefined;
  period: Period;
  isLoading: boolean;
  hasMore: boolean;
  hasError: boolean;
}): SelectedPlanState {
  if (hasError) return { status: "error" };

  if (!plan) {
    return isLoading || hasMore
      ? { status: "loading" }
      : { status: "missing" };
  }

  const price = period === "annual" ? plan.annualFee : plan.fee;
  const available =
    period === "month" ? !!plan.fee || !plan.hasBaseFee : !!plan.annualFee;

  return available
    ? { status: "ready", plan, price }
    : { status: "unavailable", plan, price };
}

export type SelectedPlanState =
  | { status: "loading" | "error" | "missing" }
  | {
      status: "ready" | "unavailable";
      plan: Plan;
      price: Plan["fee"] | Plan["annualFee"] | undefined;
    };

export function getPlanTermsAcceptanceKey({
  planId,
  userId,
  period,
  plan,
  price,
  terms,
}: {
  planId: string | null;
  userId: string | null | undefined;
  period: Period;
  plan: Plan | undefined;
  price: Plan["fee"] | Plan["annualFee"] | undefined;
  terms: PlanTerms | null;
}) {
  if (!planId || !userId || !plan || !terms) return null;

  const keyParts = [
    userId,
    planId,
    period,
    terms.version,
    price ? `${price.currencySymbol}${price.amountFormatted}` : "free",
    plan.freeTrialEnabled ? (plan.freeTrialDays ?? 0) : 0,
  ];

  return `${planTermsAcceptancePrefix}${encodeURIComponent(keyParts.join("|"))}`;
}

export type SubscribeFlowDecision =
  | { kind: "ready" }
  | { kind: "loading"; reason: "account" | "plan" }
  | {
      kind: "redirect";
      href: string;
      clearTermsAcceptance: boolean;
    };

export function resolveSubscribeFlow({
  step,
  planId,
  urls,
  selectedPlanStatus,
  isAuthLoaded,
  isSignedIn,
  termsAccepted,
}: {
  step: Step;
  planId: string | null;
  urls: ReturnType<typeof getSubscribeUrls>;
  selectedPlanStatus: SelectedPlanState["status"];
  isAuthLoaded: boolean;
  isSignedIn: boolean;
  termsAccepted: boolean;
}): SubscribeFlowDecision {
  if (step === "plan") return { kind: "ready" };

  if (!planId) {
    return {
      kind: "redirect",
      href: urls.plans,
      clearTermsAcceptance: false,
    };
  }

  const requiresPlan = step === "terms" || step === "payment";
  const invalidPlan =
    selectedPlanStatus === "error" ||
    selectedPlanStatus === "missing" ||
    selectedPlanStatus === "unavailable";

  if (requiresPlan && invalidPlan) {
    return {
      kind: "redirect",
      href: urls.plans,
      clearTermsAcceptance: true,
    };
  }

  if (!isAuthLoaded) {
    return { kind: "loading", reason: "account" };
  }

  if (step === "account") return { kind: "ready" };

  if (selectedPlanStatus === "loading") {
    return { kind: "loading", reason: "plan" };
  }

  if (!isSignedIn) {
    return {
      kind: "redirect",
      href: urls.account,
      clearTermsAcceptance: false,
    };
  }

  if (step === "payment" && !termsAccepted) {
    return {
      kind: "redirect",
      href: urls.terms,
      clearTermsAcceptance: false,
    };
  }

  return { kind: "ready" };
}
