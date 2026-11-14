import { z } from "zod";
import type {
  Plan,
  Period,
  Step,
  SubscribeQuery,
  SubscribeSearchParams,
  SubscribeSessionState,
} from "./types";

const subscribeQuerySchema = z.object({
  plan: z.string().min(1).nullable().catch(null),
  period: z.enum(["month", "annual"]).nullable().catch(null),
  auth: z.enum(["sign-in", "sign-up"]).nullable().catch(null),
});

export function parseSubscribeQuery(
  query: SubscribeSearchParams,
): SubscribeQuery {
  const singleValue = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : null;

  return subscribeQuerySchema.parse({
    plan: singleValue(query.plan),
    period: singleValue(query.period),
    auth: singleValue(query.auth),
  });
}

export function resolveSubscribeState(
  query: SubscribeQuery,
  savedState: SubscribeSessionState | null,
): SubscribeSessionState {
  return {
    planId: query.plan ?? savedState?.planId ?? null,
    period: query.period ?? savedState?.period ?? "month",
    authMode: query.auth ?? savedState?.authMode ?? "sign-up",
  };
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
  if (step === "plan") return { kind: "ready" };

  if (!planId) {
    return { kind: "redirect", href: urls.plans };
  }

  const requiresPlan = step === "payment";
  const invalidPlan =
    selectedPlanStatus === "error" ||
    selectedPlanStatus === "missing" ||
    selectedPlanStatus === "unavailable";

  if (requiresPlan && invalidPlan) {
    return { kind: "redirect", href: urls.plans };
  }

  if (!isAuthLoaded) {
    return { kind: "loading", reason: "account" };
  }

  if (step === "account") return { kind: "ready" };

  if (selectedPlanStatus === "loading") {
    return { kind: "loading", reason: "plan" };
  }

  if (!isSignedIn) {
    return { kind: "redirect", href: urls.account };
  }

  return { kind: "ready" };
}
