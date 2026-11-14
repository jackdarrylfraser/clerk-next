"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { CustomSignInForm } from "@/components/custom-sign-in-form";
import { useDevAuthBypass } from "@/components/dev-auth-bypass-provider";
import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getSubscribeUrls,
  parseSubscribeQuery,
  resolveSubscribeFlow,
} from "@/components/subscribe/flow-state";
import { SubscribeLayout } from "@/components/subscribe/subscribe-layout";
import type { SubscribeSearchParams } from "@/components/subscribe/types";

export default function SubscribeAccountPage({
  searchParams,
}: PageProps<"/subscribe/account">) {
  return (
    <Suspense
      fallback={<main className="loading-page">Loading account step...</main>}
    >
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
  const planPickerUrl = getSubscribeUrls(null, query.period).plans;
  const flowUrls = { ...urls, plans: planPickerUrl };
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
      urls={flowUrls}
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
          continueUrl={query.plan ? urls.payment : urls.plans}
        />
      )}
    </SubscribeLayout>
  );
}

function AccountStep({
  isSignedIn,
  continueUrl,
}: {
  isSignedIn: boolean;
  continueUrl: string;
}) {
  return (
    <>
      {isSignedIn ? (
        <div className="step-message">
          <p className="complete-state">
            <span>✓</span> You&apos;re signed in and ready to continue.
          </p>
          <Link className="primary-button" href={continueUrl}>
            Continue <span>↗</span>
          </Link>
        </div>
      ) : (
        <CustomSignInForm returnTo={continueUrl} />
      )}
    </>
  );
}
