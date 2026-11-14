import { SignIn, SignUp } from "@clerk/nextjs";
import Link from "next/link";
import type { AuthMode } from "./types";

const authAppearance = {
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", boxShadow: "none", border: "1px solid #edf0ea" },
  },
};

export function AccountStep({
  isSignedIn,
  authMode,
  plansUrl,
  accountUrl,
  paymentUrl,
  onAuthModeChange,
}: {
  isSignedIn: boolean;
  authMode: AuthMode;
  plansUrl: string;
  accountUrl: string;
  paymentUrl: string;
  onAuthModeChange: (authMode: AuthMode) => void;
}) {
  return (
    <>
      <Link
        href={plansUrl}
        className="back-link"
      >
        ← Back to plans
      </Link>
      <div className="section-heading">
        <span className="step-number">02</span>
        <div>
          <h2>Your account</h2>
          <p>Subscribe to create an account, or sign in to continue.</p>
        </div>
      </div>
      {isSignedIn ? (
        <div className="step-message">
          <p className="complete-state">
            <span>✓</span> You&apos;re signed in and ready to continue.
          </p>
          <Link className="primary-button" href={paymentUrl}>
            Continue to payment <span>↗</span>
          </Link>
        </div>
      ) : (
        <div className="auth-container">
          <div className="auth-tabs">
            <Link
              scroll={false}
              className={authMode === "sign-up" ? "active" : ""}
              onClick={() => onAuthModeChange("sign-up")}
              href={`${accountUrl}&auth=sign-up`}
            >
              Subscribe to create account
            </Link>
            <Link
              scroll={false}
              className={authMode === "sign-in" ? "active" : ""}
              onClick={() => onAuthModeChange("sign-in")}
              href={`${accountUrl}&auth=sign-in`}
            >
              Sign in
            </Link>
          </div>
          {authMode === "sign-in" ? (
            <SignIn
              routing="hash"
              forceRedirectUrl={paymentUrl}
              signUpUrl={`${accountUrl}&auth=sign-up`}
              appearance={authAppearance}
            />
          ) : (
            <SignUp
              routing="hash"
              forceRedirectUrl={paymentUrl}
              signInUrl={`${accountUrl}&auth=sign-in`}
              appearance={authAppearance}
            />
          )}
        </div>
      )}
    </>
  );
}
