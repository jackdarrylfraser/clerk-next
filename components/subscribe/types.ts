import type { usePlans } from "@clerk/nextjs/experimental";

export type Period = "month" | "annual";
export type AuthMode = "sign-in" | "sign-up";
export type Step = "plan" | "account" | "payment";
export type Plan = NonNullable<ReturnType<typeof usePlans>["data"]>[number];

export interface SubscribeQuery {
  plan: string | null;
  period: Period | null;
  auth: AuthMode | null;
}

export interface SubscribeSearchParams {
  [key: string]: string | string[] | undefined;
}

export interface SubscribeSessionState {
  planId: string | null;
  period: Period;
  authMode: AuthMode;
}

export function money(amount: {
  currencySymbol: string;
  amountFormatted: string;
}) {
  return `${amount.currencySymbol}${amount.amountFormatted}`;
}
