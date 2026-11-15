import { monthlyMembershipDefinition } from "./stripe-catalog-definition";

interface ManagedPrice {
  id: string;
  active: boolean;
  metadata: Record<string, string>;
}

export function getManagedPriceIdsToDeactivate(
  prices: readonly ManagedPrice[],
  currentPriceId: string,
): string[] {
  return prices
    .filter(
      (price) =>
        price.id !== currentPriceId &&
        price.active &&
        price.metadata.appCatalogKey ===
          monthlyMembershipDefinition.catalogKey,
    )
    .map((price) => price.id);
}

export function isProductionDeploymentPromotion(event: {
  type: string;
  target: string | null;
  projectId: string;
}, expectedProjectId: string): boolean {
  return (
    event.type === "deployment.promoted" &&
    (event.target === null || event.target === "production") &&
    event.projectId === expectedProjectId
  );
}
