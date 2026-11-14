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
import { AccountStep } from "@/components/subscribe/account-step";
import { SubscribeLayout } from "@/components/subscribe/subscribe-layout";
import type { SubscribeSearchParams } from "@/components/subscribe/types";

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
          plansUrl={urls.plans}
          accountUrl={urls.account}
          paymentUrl={urls.payment}
        />
      )}
    </SubscribeLayout>
  );
}
