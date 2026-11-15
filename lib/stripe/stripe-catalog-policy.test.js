import { describe, expect, it } from "bun:test";
import {
  getManagedPriceIdsToDeactivate,
  isProductionDeploymentPromotion,
} from "./stripe-catalog-policy.ts";

describe("Stripe catalog cleanup policy", () => {
  it("only deactivates older active Prices managed by this catalog", () => {
    expect(
      getManagedPriceIdsToDeactivate(
        [
          {
            id: "price_current",
            active: true,
            metadata: { appCatalogKey: "monthly-membership" },
          },
          {
            id: "price_old",
            active: true,
            metadata: { appCatalogKey: "monthly-membership" },
          },
          {
            id: "price_inactive",
            active: false,
            metadata: { appCatalogKey: "monthly-membership" },
          },
          {
            id: "price_manual",
            active: true,
            metadata: {},
          },
        ],
        "price_current",
        "monthly-membership",
      ),
    ).toEqual(["price_old"]);
  });

  it("limits cleanup to production promotions for the configured Vercel project", () => {
    expect(
      isProductionDeploymentPromotion(
        {
          type: "deployment.promoted",
          target: null,
          projectId: "prj_expected",
        },
        "prj_expected",
      ),
    ).toBe(true);
    expect(
      isProductionDeploymentPromotion(
        {
          type: "deployment.promoted",
          target: "preview",
          projectId: "prj_expected",
        },
        "prj_expected",
      ),
    ).toBe(false);
    expect(
      isProductionDeploymentPromotion(
        {
          type: "deployment.promoted",
          target: "preview",
          projectId: "prj_expected",
        },
        "prj_expected",
      ),
    ).toBe(false);
    expect(
      isProductionDeploymentPromotion(
        {
          type: "deployment.promoted",
          target: "production",
          projectId: "prj_other",
        },
        "prj_expected",
      ),
    ).toBe(false);
  });
});
