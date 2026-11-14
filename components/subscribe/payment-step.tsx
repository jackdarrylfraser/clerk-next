import Link from "next/link";
import { Checkout } from "./checkout";
import type { Plan, Period } from "./types";

export function PaymentStep({
  selectedPlan,
  period,
  accountUrl,
  plansUrl,
  onCheckoutComplete,
}: {
  selectedPlan: Plan;
  period: Period;
  accountUrl: string;
  plansUrl: string;
  onCheckoutComplete: () => void;
}) {
  return (
    <>
      <Link href={accountUrl} className="back-link">
        ← Back to your account
      </Link>
      <div className="selection-row">
        <div>
          <strong>{selectedPlan.name}</strong>
          <span>{period === "month" ? "Monthly" : "Yearly"} billing</span>
        </div>
        <Link
          href={plansUrl}
          className="text-button"
        >
          Change
        </Link>
      </div>
      <Checkout
        selectedId={selectedPlan.id}
        period={period}
        onCheckoutComplete={onCheckoutComplete}
      />
    </>
  );
}
