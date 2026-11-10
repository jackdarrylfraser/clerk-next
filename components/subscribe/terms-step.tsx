import type { ComponentType } from "react";
import Link from "next/link";
import type { Plan, Period } from "./types";
import { money } from "./types";

export function TermsStep({
  selectedPlan,
  selectedPrice,
  period,
  plansUrl,
  agreementChecked,
  PlanTermsContent,
  onAgreementChange,
  onContinue,
  onClearTermsAcceptance,
}: {
  selectedPlan: Plan;
  selectedPrice: Plan["fee"] | Plan["annualFee"] | undefined;
  period: Period;
  plansUrl: string;
  agreementChecked: boolean;
  PlanTermsContent: ComponentType | undefined;
  onAgreementChange: (checked: boolean) => void;
  onContinue: () => void;
  onClearTermsAcceptance: () => void;
}) {
  return (
    <>
      <Link
        href={`/subscribe/account?plan=${encodeURIComponent(selectedPlan.id)}&period=${period}`}
        className="back-link"
      >
        ← Back to your account
      </Link>
      <div className="section-heading">
        <span className="step-number">03</span>
        <div>
          <h2>Review your plan terms</h2>
          <p>Review the subscription details and agree to continue.</p>
        </div>
      </div>
      <div className="terms-content">
        <h3>{selectedPlan.name}</h3>
        <p>
          {selectedPrice
            ? `${money(selectedPrice)} per ${period === "month" ? "month" : "year"}`
            : `Free ${period === "month" ? "monthly" : "yearly"} plan`}
        </p>
        {selectedPlan.freeTrialEnabled && selectedPlan.freeTrialDays && (
          <p>{selectedPlan.freeTrialDays}-day free trial, if eligible.</p>
        )}
        {selectedPrice && (
          <p>Your subscription renews at this rate unless canceled.</p>
        )}
        {PlanTermsContent && <PlanTermsContent />}
      </div>
      <label className="terms-agreement">
        <input
          type="checkbox"
          checked={agreementChecked}
          onChange={(event) => onAgreementChange(event.currentTarget.checked)}
        />
        <span>
          I have read and agree to the terms for the {selectedPlan.name} plan.
        </span>
      </label>
      <button
        type="button"
        className="primary-button terms-continue"
        onClick={onContinue}
        disabled={!agreementChecked}
      >
        Continue to payment <span>↗</span>
      </button>
      <Link
        href={plansUrl}
        className="text-button terms-change-plan"
        onClick={onClearTermsAcceptance}
      >
        Change plan
      </Link>
    </>
  );
}
