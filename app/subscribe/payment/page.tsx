import { Suspense } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePlans } from "@clerk/nextjs/experimental";
import { useDevAuthBypass } from "@/components/dev-auth-bypass-provider";
import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getSelectedPlanState,
  getSubscribeUrls,
  parseSubscribeQuery,
  resolveSubscribeFlow,
} from "@/components/subscribe/flow-state";
import { PaymentStep } from "@/components/subscribe/payment-step";
import { SubscribeLayout } from "@/components/subscribe/subscribe-layout";
import { useSubscribeSession } from "@/components/subscribe/use-subscribe-session";
import type { SubscribeSearchParams } from "@/components/subscribe/types";

export default function SubscribePaymentPage({
  searchParams,
}: PageProps<"/subscribe/payment">) {
  return (
    <Suspense fallback={<main className="loading-page">Loading payment step...</main>}>
      <SubscribePaymentContent searchParams={searchParams} />
    </Suspense>
  );
}

function SubscribePaymentContent({
  searchParams,
}: {
  searchParams: Promise<SubscribeSearchParams>;
}) {
  const query = parseSubscribeQuery(use(searchParams));
  const session = useSubscribeSession(query);
  const { isLoaded, isSignedIn } = useAuth();
  const devAuthBypassEnabled = useDevAuthBypass();
  const router = useRouter();
  const plans = usePlans({ for: "user", pageSize: 10, infinite: true });
  const matchingPlan = plans.data?.find(
    (plan) => plan.id === session.state.planId,
  );
  const selectedPlanState = getSelectedPlanState({
    plan: matchingPlan,
    period: session.state.period,
    isLoading: plans.isLoading,
    hasMore: plans.hasNextPage,
    hasError: plans.isError,
  });
  const selectedPlan =
    "plan" in selectedPlanState ? selectedPlanState.plan : undefined;
  const urls = getSubscribeUrls(session.state.planId, session.state.period);
  const decision = resolveSubscribeFlow({
    step: "payment",
    planId: session.state.planId,
    urls,
    selectedPlanStatus: selectedPlanState.status,
    isAuthLoaded: isLoaded,
    isSignedIn: !!isSignedIn,
  });
  const redirectUrl = decision.kind === "redirect" ? decision.href : null;
  const fetchNextPlans = plans.fetchNext;

  useEffect(() => {
    if (
      !session.isReady ||
      !session.state.planId ||
      selectedPlan ||
      plans.isError ||
      !plans.hasNextPage
    ) {
      return;
    }

    void fetchNextPlans();
  }, [
    fetchNextPlans,
    plans.hasNextPage,
    plans.isError,
    selectedPlan,
    session.isReady,
    session.state.planId,
  ]);

  useEffect(() => {
    if (session.isReady && redirectUrl) router.replace(redirectUrl);
  }, [session.isReady, redirectUrl, router]);

  return (
    <SubscribeLayout
      step="payment"
      selectedId={session.state.planId}
      isLoaded={isLoaded}
      isSignedIn={!!isSignedIn}
      devAuthBypassEnabled={devAuthBypassEnabled}
      storageError={session.storageError}
    >
      {!session.isReady ? (
        <p className="muted-indent" role="status">
          Restoring your subscription choices...
        </p>
      ) : decision.kind === "redirect" ? (
        <p className="muted-indent" role="status">
          Taking you to the right step...
        </p>
      ) : decision.kind === "loading" ? (
        <p className="muted-indent">
          {decision.reason === "account"
            ? "Loading your account..."
            : "Loading your selected plan..."}
        </p>
      ) : selectedPlan ? (
        <PaymentStep
          selectedPlan={selectedPlan}
          period={session.state.period}
          accountUrl={urls.account}
          plansUrl={urls.plans}
          onCheckoutComplete={session.clear}
        />
      ) : null}
    </SubscribeLayout>
  );
}
