import { z } from "zod";
import type {
  Plan,
  Period,
  Step,
  SubscribeQuery,
  SubscribeSearchParams,
} from "./types";

const subscribeQuerySchema = z.object({
  plan: z.string().min(1).nullable().catch(null),
  period: z.enum(["month", "annual"]).catch("month"),
  auth: z.enum(["sign-in", "sign-up"]).catch("sign-up"),
});

export function parseSubscribeQuery(
  query: SubscribeSearchParams,
): SubscribeQuery {
  const singleValue = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : null;

  return subscribeQuerySchema.parse({
    plan: singleValue(query.plan),
    period: singleValue(query.period) ?? undefined,
    auth: singleValue(query.auth) ?? undefined,
  });
}

export function getSubscribeUrls(planId: string | null, period: Period) {
  const planQuery = planId
    ? `plan=${encodeURIComponent(planId)}&period=${period}`
    : `period=${period}`;

  return {
    plans: `/subscribe?${planQuery}`,
    account: `/subscribe/account?${planQuery}`,
    payment: `/subscribe/payment?${planQuery}`,
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

export type SubscribeFlowDecision =
  | { kind: "ready" }
  | { kind: "loading"; reason: "account" | "plan" }
  | { kind: "redirect"; href: string };

export function resolveSubscribeFlow({
  step,
  planId,
  urls,
  selectedPlanStatus,
  isAuthLoaded,
  isSignedIn,
}: {
  step: Step;
  planId: string | null;
  urls: ReturnType<typeof getSubscribeUrls>;
  selectedPlanStatus: SelectedPlanState["status"];
  isAuthLoaded: boolean;
  isSignedIn: boolean;
}): SubscribeFlowDecision {
  if (!isAuthLoaded) {
    return { kind: "loading", reason: "account" };
  }

  if (step === "account") {
    return isSignedIn
      ? { kind: "redirect", href: urls.plans }
      : { kind: "ready" };
  }

  if (step === "plan") {
    if (!isSignedIn) {
      return { kind: "redirect", href: urls.account };
    }
    if (!planId) return { kind: "ready" };
    if (selectedPlanStatus === "loading") {
      return { kind: "loading", reason: "plan" };
    }
    return selectedPlanStatus === "ready"
      ? { kind: "redirect", href: urls.payment }
      : { kind: "ready" };
  }

  if (!isSignedIn) {
    return { kind: "redirect", href: urls.account };
  }

  if (!planId) {
    return { kind: "redirect", href: urls.plans };
  }

  if (selectedPlanStatus === "loading") {
    return { kind: "loading", reason: "plan" };
  }

  const invalidPlan =
    selectedPlanStatus === "error" ||
    selectedPlanStatus === "missing" ||
    selectedPlanStatus === "unavailable";

  if (invalidPlan) {
    return { kind: "redirect", href: urls.plans };
  }

  return { kind: "ready" };
}
