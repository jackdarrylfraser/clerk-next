import type { usePlans } from "@clerk/nextjs/experimental";

export type Period = "month" | "annual";
export type Step = "plan" | "account" | "terms" | "payment";
export type Plan = NonNullable<ReturnType<typeof usePlans>["data"]>[number];

export function money(amount: {
  currencySymbol: string;
  amountFormatted: string;
}) {
  return `${amount.currencySymbol}${amount.amountFormatted}`;
}
