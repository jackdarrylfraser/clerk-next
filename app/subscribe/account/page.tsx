"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { useAuth } from "@clerk/nextjs";
import { useDevAuthBypass } from "@/components/dev-auth-bypass-provider";
import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getSubscribeUrls,
  parseSubscribeQuery,
  resolveSubscribeFlow,
} from "@/components/subscribe/flow-state";
import { SubscribeLayout } from "@/components/subscribe/subscribe-layout";
import { clerkAuthAppearance } from "@/lib/clerk-appearance";
import type {
  AuthMode,
  SubscribeSearchParams,
} from "@/components/subscribe/types";

const authAppearance = {
  ...clerkAuthAppearance,
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", boxShadow: "none" },
  },
};

export default function SubscribeAccountPage({
  searchParams,
}: PageProps<"/subscribe/account">) {
  return (
    <Suspense fallback={<main className="loading-page">Loading account step...</main>}>
      <SubscribeAccountContent searchParams={searchParams} />
    </Suspense>
  );
}

function SubscribeAccountContent({
  searchParams,
}: {
  searchParams: Promise<SubscribeSearchParams>;
}) {
  const query = parseSubscribeQuery(use(searchParams));
  const { isLoaded, isSignedIn } = useAuth();
  const devAuthBypassEnabled = useDevAuthBypass();
  const router = useRouter();
  const urls = getSubscribeUrls(query.plan, query.period);
  const decision = resolveSubscribeFlow({
    step: "account",
    planId: query.plan,
    urls,
    selectedPlanStatus: "ready",
    isAuthLoaded: isLoaded,
    isSignedIn: !!isSignedIn,
  });
  const redirectUrl = decision.kind === "redirect" ? decision.href : null;

  useEffect(() => {
    if (redirectUrl) router.replace(redirectUrl);
  }, [redirectUrl, router]);

  return (
    <SubscribeLayout
      step="account"
      selectedId={query.plan}
      urls={urls}
      isLoaded={isLoaded}
      isSignedIn={!!isSignedIn}
      devAuthBypassEnabled={devAuthBypassEnabled}
    >
      {decision.kind === "loading" ? (
        <p className="muted-indent" role="status">
          Loading your account...
        </p>
      ) : redirectUrl ? (
        <p className="muted-indent" role="status">
          Taking you to the right step...
        </p>
      ) : (
        <AccountStep
          isSignedIn={!!isSignedIn}
          authMode={query.auth}
          accountUrl={urls.account}
          paymentUrl={urls.payment}
        />
      )}
    </SubscribeLayout>
  );
}

function AccountStep({
  isSignedIn,
  authMode,
  accountUrl,
  paymentUrl,
}: {
  isSignedIn: boolean;
  authMode: AuthMode;
  accountUrl: string;
  paymentUrl: string;
}) {
  return (
    <>
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
        <div className="auth-container clerk-auth">
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
