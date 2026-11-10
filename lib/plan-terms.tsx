import type { ComponentType } from "react";
import { SubscriptionTerms } from "@/terms/subscription-terms";

export type PlanTerms = {
  version: string;
  content: ComponentType;
};

export const planTermsBySlug: Readonly<Record<string, PlanTerms>> = {
  coach: {
    version: "subscription-terms-v1",
    content: SubscriptionTerms,
  },
};

export const planTermsAcceptancePrefix = "clerk-next:plan-terms:";

const acceptanceListeners = new Set<() => void>();

export function getPlanTerms(planSlug: string): PlanTerms | undefined {
  return planTermsBySlug[planSlug];
}

export function subscribeToPlanTermsAcceptance(listener: () => void) {
  acceptanceListeners.add(listener);
  return () => acceptanceListeners.delete(listener);
}

export function hasAcceptedPlanTerms(key: string | null) {
  return (
    !!key &&
    typeof window !== "undefined" &&
    sessionStorage.getItem(key) === "accepted"
  );
}

export function acceptPlanTerms(key: string) {
  sessionStorage.setItem(key, "accepted");
  acceptanceListeners.forEach((listener) => listener());
}

export function revokePlanTermsAcceptance(key: string) {
  sessionStorage.removeItem(key);
  acceptanceListeners.forEach((listener) => listener());
}

export function clearPlanTermsAcceptances() {
  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index);
    if (key?.startsWith(planTermsAcceptancePrefix)) {
      sessionStorage.removeItem(key);
    }
  }
  acceptanceListeners.forEach((listener) => listener());
}
