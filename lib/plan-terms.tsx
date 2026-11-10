import type { ComponentType } from "react";

export type PlanTerms = {
  version: string;
  content: ComponentType;
};

export const planTermsById: Readonly<Record<string, PlanTerms>> = {
  // Add each Clerk plan ID here with its approved, plan-specific terms.
};

const defaultPlanTerms: PlanTerms = {
  version: "subscription-details-v1",
  content: () => null,
};

export const planTermsAcceptancePrefix = "clerk-next:plan-terms:";

const acceptanceListeners = new Set<() => void>();

export function getPlanTerms(planId: string): PlanTerms {
  return planTermsById[planId] ?? defaultPlanTerms;
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
