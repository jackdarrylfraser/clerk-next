import Link from "next/link";
import { Checkout } from "./checkout";
import type { Plan, Period } from "./types";

export function PaymentStep({
  selectedId,
  isLoaded,
  isSignedIn,
  selectedPlan,
  isPlanLoading,
  hasMorePlans,
  planAvailable,
  termsAccepted,
  period,
  accountUrl,
  termsUrl,
  plansUrl,
  onClearTermsAcceptance,
}: {
  selectedId: string | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  selectedPlan: Plan | undefined;
  isPlanLoading: boolean;
  hasMorePlans: boolean;
  planAvailable: boolean;
  termsAccepted: boolean;
  period: Period;
  accountUrl: string;
  termsUrl: string;
  plansUrl: string;
  onClearTermsAcceptance: () => void;
}) {
  return !selectedId ? (
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
      <p>
        Create an account or sign in before entering payment details.
      </p>
      <Link href={accountUrl} className="primary-button">
        Continue to account <span>↗</span>
      </Link>
    </div>
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
  ) : !termsAccepted ? (
    <div className="step-message">
      <p>Agree to your plan terms before entering payment details.</p>
      <Link href={termsUrl} className="primary-button">
        Review plan terms <span>↗</span>
      </Link>
    </div>
  ) : (
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
      <Checkout selectedId={selectedId} period={period} />
    </>
  );
}
