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
import { useSubscribeSession } from "@/components/subscribe/use-subscribe-session";
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
  const session = useSubscribeSession(query);
  const { isLoaded, isSignedIn } = useAuth();
  const devAuthBypassEnabled = useDevAuthBypass();
  const router = useRouter();
  const urls = getSubscribeUrls(session.state.planId, session.state.period);
  const decision = resolveSubscribeFlow({
    step: "account",
    planId: session.state.planId,
    urls,
    selectedPlanStatus: "ready",
    isAuthLoaded: isLoaded,
    isSignedIn: !!isSignedIn,
  });
  const redirectUrl = decision.kind === "redirect" ? decision.href : null;

  useEffect(() => {
    if (session.isReady && redirectUrl) router.replace(redirectUrl);
  }, [session.isReady, redirectUrl, router]);

  return (
    <SubscribeLayout
      step="account"
      selectedId={session.state.planId}
      isLoaded={isLoaded}
      isSignedIn={!!isSignedIn}
      devAuthBypassEnabled={devAuthBypassEnabled}
      storageError={session.storageError}
    >
      {!session.isReady || decision.kind === "loading" ? (
        <p className="muted-indent" role="status">
          {!session.isReady
            ? "Restoring your subscription choices..."
            : "Loading your account..."}
        </p>
      ) : redirectUrl ? (
        <p className="muted-indent" role="status">
          Taking you to the right step...
        </p>
      ) : (
        <AccountStep
          isSignedIn={!!isSignedIn}
          authMode={session.state.authMode}
          plansUrl={urls.plans}
          accountUrl={urls.account}
          paymentUrl={urls.payment}
          onAuthModeChange={(authMode) => session.update({ authMode })}
        />
      )}
    </SubscribeLayout>
  );
}
