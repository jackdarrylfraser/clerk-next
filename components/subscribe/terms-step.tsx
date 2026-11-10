import type { ComponentType } from "react";
import Link from "next/link";
import type { Plan, Period } from "./types";
import { money } from "./types";

export function TermsStep({
  selectedId,
  isLoaded,
  isSignedIn,
  isPlanError,
  isPlanLoading,
  hasMorePlans,
  selectedPlan,
  selectedPrice,
  period,
  planAvailable,
  accountUrl,
  plansUrl,
  agreementChecked,
  PlanTermsContent,
  onAgreementChange,
  onContinue,
  onClearTermsAcceptance,
}: {
  selectedId: string | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  isPlanError: boolean;
  isPlanLoading: boolean;
  hasMorePlans: boolean;
  selectedPlan: Plan | undefined;
  selectedPrice: Plan["fee"] | Plan["annualFee"] | undefined;
  period: Period;
  planAvailable: boolean;
  accountUrl: string;
  plansUrl: string;
  agreementChecked: boolean;
  PlanTermsContent: ComponentType | undefined;
  onAgreementChange: (checked: boolean) => void;
  onContinue: () => void;
  onClearTermsAcceptance: () => void;
}) {
  return (
    <>
      <Link href={accountUrl} className="back-link">
        ← Back to your account
      </Link>
      <div className="section-heading">
        <span className="step-number">03</span>
        <div>
          <h2>Review your plan terms</h2>
          <p>Review the subscription details and agree to continue.</p>
        </div>
      </div>
      {!selectedId ? (
        <div className="step-message">
          <p>Please choose a plan before continuing.</p>
          <Link className="primary-button" href="/subscribe">
            View plans <span>↗</span>
          </Link>
        </div>
      ) : !isLoaded ? (
        <p className="muted-indent">Loading your account...</p>
      ) : !isSignedIn ? (
        <div className="step-message">
          <p>Create an account or sign in before reviewing plan terms.</p>
          <Link className="primary-button" href={accountUrl}>
            Continue to account <span>↗</span>
          </Link>
        </div>
      ) : isPlanError ? (
        <p className="error-message" role="alert">
          Couldn&apos;t load the selected plan. Please return to the plans and try
          again.
        </p>
      ) : !selectedPlan && (isPlanLoading || hasMorePlans) ? (
        <p className="muted-indent">Loading your selected plan...</p>
      ) : !selectedPlan ? (
        <div className="step-message">
          <p>The selected plan could not be found.</p>
          <Link className="primary-button" href={plansUrl}>
            Choose another plan <span>↗</span>
          </Link>
        </div>
      ) : !planAvailable ? (
        <div className="step-message">
          <p>This plan is not available for the selected billing period.</p>
          <Link
            className="primary-button"
            href={plansUrl}
            onClick={onClearTermsAcceptance}
          >
            Choose another plan <span>↗</span>
          </Link>
        </div>
      ) : (
        <>
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
              onChange={(event) =>
                onAgreementChange(event.currentTarget.checked)
              }
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
      )}
    </>
  );
}
