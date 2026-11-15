export interface StripeCatalogDefinition {
  catalogKey: string;
  lookupKey: string;
  productName: string;
  productDescription: string;
  unitAmount: number;
  currency: string;
  interval: "day" | "week" | "month" | "year";
  intervalCount: number;
}

export const monthlyMembershipDefinition = {
  catalogKey: "monthly-membership",
  lookupKey: "monthly-membership",
  productName: "Monthly membership",
  productDescription: "Monthly membership subscription",
  unitAmount: 2500,
  currency: "usd",
  interval: "month",
  intervalCount: 1,
} as const satisfies StripeCatalogDefinition;
