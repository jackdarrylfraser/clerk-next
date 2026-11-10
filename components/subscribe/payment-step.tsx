import Link from "next/link";
import { Checkout } from "./checkout";
import type { Plan, Period } from "./types";

export function PaymentStep({
  selectedPlan,
  period,
  termsUrl,
  plansUrl,
  onClearTermsAcceptance,
}: {
  selectedPlan: Plan;
  period: Period;
  termsUrl: string;
  plansUrl: string;
  onClearTermsAcceptance: () => void;
}) {
  return (
    <>
      <Link href={termsUrl} className="back-link">
        ← Back to plan terms
      </Link>
      <div className="selection-row">
        <div>
          <strong>{selectedPlan.name}</strong>
          <span>{period === "month" ? "Monthly" : "Yearly"} billing</span>
        </div>
        <Link
          href={plansUrl}
          className="text-button"
          onClick={onClearTermsAcceptance}
        >
          Change
        </Link>
      </div>
      <Checkout selectedId={selectedPlan.id} period={period} />
    </>
  );
}
